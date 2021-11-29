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

export type Cacao = {
  h: Header
  p: Payload
  s: Signature
}

export interface CacaoBlock {
  value: Cacao
  cid: multiformats.CID
  bytes: Uint8Array
}

class CACAO {
  cacao: Cacao
  constructor(siwe: string | SiweMessage) {
    const siweMessage = typeof siwe === 'string' ? new SiweMessage(siwe) : siwe
    if (!siweMessage.signature) {
      throw new Error('SIWE Message has not been signed yet')
    }
    this.cacao = this.fromSiweMessage(siweMessage)
  }

  async toCacaoBlock(): Promise<CacaoBlock> {
    const block = await Block.encode({
      value: this.cacao,
      codec: dagCbor,
      hasher: hasher,
    })
    return block as CacaoBlock
  }

  private fromSiweMessage(siweMessage: SiweMessage): Cacao {
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
      s: {
        s: siweMessage.signature,
      },
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
}

export default CACAO
