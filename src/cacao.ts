import { SiweMessage } from 'siwe'

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
  resources?: string[]
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
  cacao: Cacao
  // cid: CID
  bytes: Uint8Array
}

class CACAO {
  cacao: Cacao
  constructor(siwe: string | SiweMessage) {
    const siweMessage = typeof siwe === 'string' ? new SiweMessage(siwe) : siwe
    this.cacao = this.fromSiweMessage(siweMessage)
  }

  // TODO: Implement this API
  // toCacaoBlock(): CacaoBlock {}

  private fromSiweMessage(siweMessage: SiweMessage): Cacao {
    return {
      h: {
        t: 'eip4361-eip191',
      },
      p: {
        domain: siweMessage.domain,
        exp: Date.parse(siweMessage.expirationTime),
        iat: Date.parse(siweMessage.issuedAt),
        iss: siweMessage.address,
        chainId: Number(siweMessage.chainId),
        aud: siweMessage.uri,
        version: siweMessage.version,
        nonce: siweMessage.nonce,
        nbf: Date.parse(siweMessage.notBefore),
        statement: siweMessage.statement,
        requestId: siweMessage.requestId,
        resources: siweMessage.resources,
      },
      s: {
        s: siweMessage.signature,
      },
    }
  }
}

export default CACAO
