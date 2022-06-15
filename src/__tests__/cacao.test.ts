import { Wallet } from '@ethersproject/wallet'
import { extractPublicKeyFromSecretKey, sign } from '@stablelib/ed25519'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { Cacao, CacaoBlock } from '../cacao.js'
import { SiweMessage } from '../siwx/siwe.js'
import { SiwsMessage } from '../siwx/siws.js'

describe('Cacao', () => {
  const ethWallet = Wallet.fromMnemonic(
    'despair voyage estate pizza main slice acquire mesh polar short desk lyrics'
  )
  const ethAddress = ethWallet.address

  const solanaSecretKey = fromString(
    '92e08e39aee87d53fe263913bf9df6615c1c909860a1d3ad57bd0e6e2e507161ecbf1e2d9da80d3ae09de54ce71cbff723e291e7a4b133ce10993be5edfaca50',
    'hex'
  )

  test('Can create and verify Cacao Block for Ethereum', async () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: ethAddress,
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'did:key:z6MkrBdNdwUPnXDVD1DCxedzVVBpaGi8aSmoXFAeKNgtAer8',
      version: '1',
      nonce: '32891757',
      issuedAt: '2021-09-30T16:25:24.000Z',
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const signature = await ethWallet.signMessage(msg.signMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const block = await CacaoBlock.fromCacao(cacao)
    expect(block).toMatchSnapshot()

    expect(() => Cacao.verify(cacao)).not.toThrow()
  })

  test('Can create and verify Cacao Block for Solana', async () => {
    const msg = new SiwsMessage({
      domain: 'service.org',
      address: toString(extractPublicKeyFromSecretKey(solanaSecretKey), 'base58btc'),
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'did:key:z6MkrBdNdwUPnXDVD1DCxedzVVBpaGi8aSmoXFAeKNgtAer8',
      version: '1',
      nonce: '32891757',
      issuedAt: '2021-09-30T16:25:24.000Z',
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const signData = msg.signMessage()
    const rawSignature = sign(solanaSecretKey, signData)
    const signature = toString(rawSignature, 'base58btc')
    msg.signature = signature

    const cacao = Cacao.fromSiwsMessage(msg)
    const block = await CacaoBlock.fromCacao(cacao)
    expect(block).toMatchSnapshot()
    expect(() => Cacao.verify(cacao)).not.toThrow()
  })

  test('Converts between Cacao and SiweMessage', () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: ethAddress,
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: '2021-09-30T16:25:24.000Z',
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const cacao = Cacao.fromSiweMessage(msg)
    const siwe = SiweMessage.fromCacao(cacao)
    expect(siwe).toEqual(msg)
  })

  test('Converts between Cacao and SiwsMessage', () => {
    const msg = new SiwsMessage({
      domain: 'service.org',
      address: toString(extractPublicKeyFromSecretKey(solanaSecretKey), 'base58btc'),
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: '2021-09-30T16:25:24.000Z',
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const cacao = Cacao.fromSiwsMessage(msg)
    const siws = SiwsMessage.fromCacao(cacao)
    expect(siws).toEqual(msg)
  })

  test('ok after exp if within phase out period', async () => {
    const fixedDate = new Date('2021-10-14T07:18:41Z')
    const msg = new SiweMessage({
      domain: 'service.org',
      address: ethAddress,
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: fixedDate.toISOString(),
      expirationTime: new Date(fixedDate.valueOf() + 5 * 1000).toISOString(),
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const signature = await ethWallet.signMessage(msg.toMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const expiredTime = new Date(fixedDate.valueOf() + 10 * 1000)
    expect(() =>
      Cacao.verify(cacao, { atTime: expiredTime, revocationPhaseOutSecs: 20 })
    ).not.toThrow()
  })

  test('fail after exp if after phase out period', async () => {
    const fixedDate = new Date('2021-10-14T07:18:41Z')
    const msg = new SiweMessage({
      domain: 'service.org',
      address: ethAddress,
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: fixedDate.toISOString(),
      expirationTime: new Date(fixedDate.valueOf() + 5 * 1000).toISOString(),
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const signature = await ethWallet.signMessage(msg.signMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const expiredTime = new Date(fixedDate.valueOf() + 10 * 1000)
    expect(() => Cacao.verify(cacao, { atTime: expiredTime, revocationPhaseOutSecs: 1 })).toThrow(
      `CACAO has expired`
    )
  })
})
