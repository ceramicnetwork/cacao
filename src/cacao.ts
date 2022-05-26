import { verifyMessage } from '@ethersproject/wallet'
import * as dagCbor from '@ipld/dag-cbor'
import * as multiformats from 'multiformats'
import * as Block from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { SiweMessage } from './siwe.js'
import { AccountId } from 'caip'

export type Header = {
  t: 'eip4361'
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
  t: 'eip191' | 'eip1271'
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
  expPhaseOutSecs?: number
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

  export function verify(cacao: Cacao, options: VerifyOptions = {}) {
    if (cacao.h.t === 'eip4361' && cacao.s?.t === 'eip191') {
      return verifyEIP191Signature(cacao, options)
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

    const phaseOutMS = options.expPhaseOutSecs ? options.expPhaseOutSecs * 1000 : 0

    if (Date.parse(cacao.p.exp) + phaseOutMS < atTime) {
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
