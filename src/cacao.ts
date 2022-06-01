import { verifyMessage } from '@ethersproject/wallet'
import * as dagCbor from '@ipld/dag-cbor'
import * as multiformats from 'multiformats'
import * as Block from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { SiweMessage } from './siwx/siwe.js'
import { AccountId } from 'caip'
import { SiwsMessage } from './siwx/siws.js'
import base58 from 'bs58'
import nacl from 'tweetnacl'

export type Header = {
  t: 'eip4361' | 'CASAXX'
}

export type Payload = {
  domain: string
  iss: string
  aud: string
  version: string
  nonce: string
  iat: string
  nbf?: string
  exp?: string
  statement?: string
  requestId?: string
  resources?: Array<string>
}

export type Signature = {
  t: 'eip191' | 'eip1271' | 'solana'
  s: string
}
export type Cacao = {
  h: Header
  p: Payload
  s?: Signature
}

export type VerifyOptions = {
  /**
   * @param atTime - the point in time the capability is being verified for
   */
  atTime?: Date
}

export namespace Cacao {
  export function fromSiweMessage(siweMessage: SiweMessage): Cacao {
    const cacao: Cacao = {
      h: {
        t: 'eip4361',
      },
      p: {
        domain: siweMessage.domain,
        iat: siweMessage.issuedAt,
        iss: `did:pkh:eip155:${siweMessage.chainId}:${siweMessage.address}`,
        aud: siweMessage.uri,
        version: siweMessage.version,
        nonce: siweMessage.nonce,
      },
    }

    if (siweMessage.signature) {
      cacao.s = {
        t: 'eip191',
        s: siweMessage.signature,
      }
    }

    if (siweMessage.notBefore) {
      cacao.p.nbf = siweMessage.notBefore
    }

    if (siweMessage.expirationTime) {
      cacao.p.exp = siweMessage.expirationTime
    }

    if (siweMessage.statement) {
      cacao.p.statement = siweMessage.statement
    }

    if (siweMessage.requestId) {
      cacao.p.requestId = siweMessage.requestId
    }

    if (siweMessage.resources) {
      cacao.p.resources = siweMessage.resources
    }

    return cacao
  }

  export function fromSiwsMessage(siwsMessage: SiwsMessage): Cacao {
    const cacao: Cacao = {
      h: {
        t: 'CASAXX',
      },
      p: {
        domain: siwsMessage.domain,
        iat: siwsMessage.issuedAt,
        iss: `did:pkh:solana:${siwsMessage.chainId}:${siwsMessage.address}`,
        aud: siwsMessage.uri,
        version: siwsMessage.version,
        nonce: siwsMessage.nonce,
      },
    }

    if (siwsMessage.signature) {
      cacao.s = {
        // https://github.com/solana-labs/wallet-adapter/issues/179
        t: 'solana',
        s: siwsMessage.signature,
      }
    }

    if (siwsMessage.notBefore) {
      cacao.p.nbf = siwsMessage.notBefore
    }

    if (siwsMessage.expirationTime) {
      cacao.p.exp = siwsMessage.expirationTime
    }

    if (siwsMessage.statement) {
      cacao.p.statement = siwsMessage.statement
    }

    if (siwsMessage.requestId) {
      cacao.p.requestId = siwsMessage.requestId
    }

    if (siwsMessage.resources) {
      cacao.p.resources = siwsMessage.resources
    }

    return cacao
  }

  export function verify(cacao: Cacao, options: VerifyOptions = {}) {
    if (cacao.h.t === 'eip4361' && cacao.s?.t === 'eip191') {
      return verifyEIP191Signature(cacao, options)
    } else if (cacao.h.t === 'CASAXX' && cacao.s?.t === 'solana') {
      return verifySolanaSignature(cacao, options)
    }
    throw new Error('Unsupported CACAO signature type')
  }

  export function verifyEIP191Signature(cacao: Cacao, options: VerifyOptions) {
    if (!cacao.s) {
      throw new Error(`CACAO does not have a signature`)
    }

    const atTime = options.atTime ? options.atTime.getTime() : Date.now()

    if (Date.parse(cacao.p.iat) > atTime || Date.parse(cacao.p.nbf) > atTime) {
      throw new Error(`CACAO is not valid yet`)
    }

    if (Date.parse(cacao.p.exp) < atTime) {
      throw new Error(`CACAO has expired`)
    }

    const msg = SiweMessage.fromCacao(cacao)
    const sig = cacao.s.s
    const recoveredAddress = verifyMessage(msg.toMessage(), sig)
    const issAddress = AccountId.parse(cacao.p.iss.replace('did:pkh:', '')).address
    if (recoveredAddress.toLowerCase() !== issAddress.toLowerCase()) {
      throw new Error(`Signature does not belong to issuer`)
    }
  }
}

export function verifySolanaSignature(cacao: Cacao, options: VerifyOptions) {
  if (!cacao.s) {
    throw new Error(`CACAO does not have a signature`)
  }
  const atTime = options.atTime ? options.atTime.getTime() : Date.now()

  if (Date.parse(cacao.p.iat) > atTime || Date.parse(cacao.p.nbf) > atTime) {
    throw new Error(`CACAO is not valid yet`)
  }

  if (Date.parse(cacao.p.exp) < atTime) {
    throw new Error(`CACAO has expired`)
  }

  const msg = SiwsMessage.fromCacao(cacao)
  const sig = cacao.s.s

  const signDataU8 = msg.signMessage()
  const sigU8 = base58.decode(sig)
  const issAddress = AccountId.parse(cacao.p.iss.replace('did:pkh:', '')).address
  const pubKeyU8 = base58.decode(issAddress)

  if (!nacl.sign.detached.verify(signDataU8, sigU8, pubKeyU8)) {
    throw new Error(`Signature does not belong to issuer`)
  }
}

export type CacaoBlock = {
  value: Cacao
  cid: multiformats.CID
  bytes: Uint8Array
}

export namespace CacaoBlock {
  export async function fromCacao(cacao: Cacao): Promise<CacaoBlock> {
    const block = await Block.encode<Cacao, number, number>({
      value: cacao,
      codec: dagCbor,
      hasher: hasher,
    })
    return block
  }
}
