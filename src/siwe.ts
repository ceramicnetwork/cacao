import type { Cacao } from './cacao.js'
import { ParsedMessage as ABNFParsedMessage } from './abnf.js'
import { AccountId, ChainId } from 'caip'

/**
 * Possible message error types.
 */
export enum ErrorTypes {
  /**Thrown when the `validate()` function can verify the message. */
  INVALID_SIGNATURE = 'Invalid signature.',
  /**Thrown when the `expirationTime` is present and in the past. */
  EXPIRED_MESSAGE = 'Expired message.',
  /**Thrown when some required field is missing. */
  MALFORMED_SESSION = 'Malformed session.',
}

/**
 * Possible signature types that this library supports.
 */
export enum SignatureType {
  /**EIP-191 signature scheme */
  PERSONAL_SIGNATURE = 'Personal signature',
}

export class SiweMessage {
  /**RFC 4501 dns authority that is requesting the signing. */
  domain: string
  /**Ethereum address performing the signing conformant to capitalization
   * encoded checksum specified in EIP-55 where applicable. */
  address: string
  /**Human-readable ASCII assertion that the user will sign, and it must not
   * contain `\n`. */
  statement?: string
  /**RFC 3986 URI referring to the resource that is the subject of the signing
   *  (as in the __subject__ of a claim). */
  uri: string
  /**Current version of the message. */
  version: string
  /**Randomized token used to prevent replay attacks, at least 8 alphanumeric
   * characters. */
  nonce?: string
  /**ISO 8601 datetime string of the current time. */
  issuedAt?: string
  /**ISO 8601 datetime string that, if present, indicates when the signed
   * authentication message is no longer valid. */
  expirationTime?: string
  /**ISO 8601 datetime string that, if present, indicates when the signed
   * authentication message will become valid. */
  notBefore?: string
  /**System-specific identifier that may be used to uniquely refer to the
   * sign-in request. */
  requestId?: string
  /**EIP-155 Chain ID to which the session is bound, and the network where
   * Contract Accounts must be resolved. */
  chainId?: string
  /**List of information or references to information the user wishes to have
   * resolved as part of authentication by the relying party. They are
   * expressed as RFC 3986 URIs separated by `\n- `. */
  resources?: Array<string>
  /**Signature of the message signed by the wallet. */
  signature?: string
  /**Type of sign message to be generated. */
  type?: SignatureType

  /**
   * Creates a parsed Sign-In with Ethereum Message (EIP-4361) object from a
   * string or an object. If a string is used an ABNF parser is called to
   * validate the parameter, otherwise the fields are attributed.
   * @param param {string | SiweMessage} Sign message as a string or an object.
   */
  constructor(param: string | Partial<SiweMessage>) {
    if (typeof param === 'string') {
      const parsedMessage = new ABNFParsedMessage(param)
      this.domain = parsedMessage.domain
      this.address = parsedMessage.address
      this.statement = parsedMessage.statement
      this.uri = parsedMessage.uri
      this.version = parsedMessage.version
      this.nonce = parsedMessage.nonce
      this.issuedAt = parsedMessage.issuedAt
      this.expirationTime = parsedMessage.expirationTime
      this.notBefore = parsedMessage.notBefore
      this.requestId = parsedMessage.requestId
      this.chainId = parsedMessage.chainId
      this.resources = parsedMessage.resources
    } else {
      Object.assign(this, param)
    }
  }

  static fromCacao(cacao: Cacao): SiweMessage {
    const account = AccountId.parse(cacao.p.iss.replace('did:pkh:', ''))
    return new SiweMessage({
      domain: cacao.p.domain,
      address: account.address,
      statement: cacao.p.statement,
      uri: cacao.p.aud,
      version: cacao.p.version,
      nonce: cacao.p.nonce,
      issuedAt: cacao.p.iat,
      expirationTime: cacao.p.exp ? cacao.p.exp : undefined,
      notBefore: cacao.p.nbf ? cacao.p.nbf : undefined,
      requestId: cacao.p.requestId,
      chainId: new ChainId(account.chainId).reference,
      resources: cacao.p.resources,
    })
  }

  /**
   * This function can be used to retrieve an EIP-4361 formated message for
   * signature, although you can call it directly it's advised to use
   * [signMessage()] instead which will resolve to the correct method based
   * on the [type] attribute of this object, in case of other formats being
   * implemented.
   * @returns {string} EIP-4361 formated message, ready for EIP-191 signing.
   */
  toMessage(): string {
    const header = `${this.domain} wants you to sign in with your Ethereum account:`
    const uriField = `URI: ${this.uri}`
    let prefix = [header, this.address].join('\n')
    const versionField = `Version: ${this.version}`

    if (!this.nonce) {
      this.nonce = (Math.random() + 1).toString(36).substring(4)
    }

    const nonceField = `Nonce: ${this.nonce}`

    const suffixArray = [uriField, versionField, nonceField]

    if (this.issuedAt) {
      Date.parse(this.issuedAt)
    }
    this.issuedAt = this.issuedAt ? this.issuedAt : new Date().toISOString()
    suffixArray.push(`Issued At: ${this.issuedAt}`)

    if (this.expirationTime) {
      const expiryField = `Expiration Time: ${this.expirationTime}`

      suffixArray.push(expiryField)
    }

    if (this.notBefore) {
      suffixArray.push(`Not Before: ${this.notBefore}`)
    }

    if (this.requestId) {
      suffixArray.push(`Request ID: ${this.requestId}`)
    }

    if (this.chainId) {
      suffixArray.push(`Chain ID: ${this.chainId}`)
    }

    if (this.resources) {
      suffixArray.push([`Resources:`, ...this.resources.map((x) => `- ${x}`)].join('\n'))
    }

    const suffix = suffixArray.join('\n')

    if (this.statement) {
      prefix = [prefix, this.statement].join('\n\n')
    }

    return [prefix, suffix].join('\n\n')
  }

  /**
   * This method parses all the fields in the object and creates a sign
   * message according with the type defined.
   * @returns {string} Returns a message ready to be signed according with the
   * type defined in the object.
   */
  signMessage(): string {
    let message: string
    switch (this.type) {
      case SignatureType.PERSONAL_SIGNATURE: {
        message = this.toMessage()
        break
      }

      default: {
        message = this.toMessage()
        break
      }
    }
    return message
  }
}
