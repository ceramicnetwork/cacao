import { verifyMessage } from '@ethersproject/wallet'
import * as dagCbor from '@ipld/dag-cbor'
import { verify } from '@stablelib/ed25519'
import { AccountId } from 'caip'
import * as multiformats from 'multiformats'
import * as Block from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { fromString as u8aFromString } from 'uint8arrays/from-string'
import { SiweMessage } from './siwx/siwe.js'
import { SiwsMessage } from './siwx/siws.js'

// 5 minute default clockskew
const CLOCK_SKEW_DEFAULT_SEC = 5 * 60

export type Header = {
  t: 'eip4361' | 'caip122'
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
  t: 'eip191' | 'eip1271' | 'solana:ed25519'
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
  /**
   * @param expPhaseOutSecs - Number of seconds that a capability stays valid for after it was expired
   */
  revocationPhaseOutSecs?: number
  /**
   * @param clockSkewSecs - Number of seconds of clock tolerance when verifying iat, nbf, and exp
   */
  clockSkewSecs?: number
}

export namespace Cacao {
  export function fromSiweMessage(siweMessage: SiweMessage): Cacao {
    const cacao: Cacao = {
      h: {
        t: 'caip122',
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
        t: 'caip122',
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
        t: 'solana:ed25519',
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
    if (cacao.s?.t === 'eip191') {
      return verifyEIP191Signature(cacao, options)
    } else if (cacao.s?.t === 'solana:ed25519') {
      return verifySolanaSignature(cacao, options)
    }
    throw new Error('Unsupported CACAO signature type')
  }

  export function verifyEIP191Signature(cacao: Cacao, options: VerifyOptions) {
    if (!cacao.s) {
      throw new Error(`CACAO does not have a signature`)
    }

    const atTime = options.atTime ? options.atTime.getTime() : Date.now()
    const clockSkew = (options.clockSkewSecs ?? CLOCK_SKEW_DEFAULT_SEC) * 1000

    if (
      Date.parse(cacao.p.iat) > atTime + clockSkew ||
      Date.parse(cacao.p.nbf) > atTime + clockSkew
    ) {
      throw new Error(`CACAO is not valid yet`)
    }

    const phaseOutMS = options.revocationPhaseOutSecs ? options.revocationPhaseOutSecs * 1000 : 0

    if (Date.parse(cacao.p.exp) + phaseOutMS + clockSkew < atTime) {
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

  const phaseOutMS = options.revocationPhaseOutSecs ? options.revocationPhaseOutSecs * 1000 : 0

  if (Date.parse(cacao.p.exp) + phaseOutMS < atTime) {
    throw new Error(`CACAO has expired`)
  }

  const msg = SiwsMessage.fromCacao(cacao)
  const sig = cacao.s.s

  const messageU8 = msg.signMessage()
  const sigU8 = u8aFromString(sig, 'base58btc')
  const issAddress = AccountId.parse(cacao.p.iss.replace('did:pkh:', '')).address
  const pubKeyU8 = u8aFromString(issAddress, 'base58btc')

  if (!verify(pubKeyU8, messageU8, sigU8)) {
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
