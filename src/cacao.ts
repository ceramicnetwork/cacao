import { verifyMessage } from '@ethersproject/wallet'
import * as dagCbor from '@ipld/dag-cbor'
import * as multiformats from 'multiformats'
import * as Block from 'multiformats/block'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { SiweMessage } from './siwe'

export type Header = {
  t: string
}

export type Payload = {
  domain: string
  iss: string
  chainId: number
  aud: string
  version: string
  nonce: string
  iat: number
  nbf?: number
  exp?: number
  statement?: string
  requestId?: string
  resources?: Array<string>
}

export type Signature = {
  s: string
}

export type VerificationResult = {
  result: boolean
  error?: any
}

export type Cacao = {
  h: Header
  p: Payload
  s?: Signature
}

export namespace Cacao {
  export function fromSiweMessage(siweMessage: SiweMessage): Cacao {
    const cacao: Cacao = {
      h: {
        t: 'eip4361-eip191',
      },
      p: {
        domain: siweMessage.domain,
        iat: Date.parse(siweMessage.issuedAt),
        iss: siweMessage.address,
        chainId: Number(siweMessage.chainId),
        aud: siweMessage.uri,
        version: siweMessage.version,
        nonce: siweMessage.nonce,
      },
    }

    if (siweMessage.signature) {
      cacao.s = {
        s: siweMessage.signature,
      }
    }

    if (siweMessage.notBefore) {
      cacao.p.nbf = Date.parse(siweMessage.notBefore)
    }

    if (siweMessage.expirationTime) {
      cacao.p.exp = Date.parse(siweMessage.expirationTime)
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

  export function verify(cacao: Cacao): VerificationResult {
    if (cacao.h.t === 'eip4361-eip191') {
      return verifyEIP191Signature(cacao)
    }
    throw new Error('Unsupported CACAO signature type')
  }

  export function verifyEIP191Signature(cacao: Cacao): VerificationResult {
    try {
      if (!cacao.s) {
        throw new Error(`CACAO does not have a signature`)
      }

      if (cacao.p.iat > Date.now() || cacao.p.nbf > Date.now()) {
        throw new Error(`CACAO is not valid yet`)
      }

      if (cacao.p.exp < Date.now()) {
        throw new Error(`CACAO has expired`)
      }

      const msg = SiweMessage.fromCacao(cacao)
      const sig = cacao.s.s
      const recoveredAddress = verifyMessage(msg.toMessage(), sig)
      if (recoveredAddress.toLowerCase() !== cacao.p.iss.toLowerCase()) {
        throw new Error(`Signature does not belong to issuer`)
      }

      return {
        result: true,
      }
    } catch (error) {
      return {
        result: false,
        error: error,
      }
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
