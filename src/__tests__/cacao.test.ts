import { Wallet } from '@ethersproject/wallet'
import { Cacao, CacaoBlock } from '../cacao.js'
import * as solanaWeb3 from '@solana/web3.js'
import { SiweMessage } from '../siwx/siwe.js'
import { SiwsMessage } from '../siwx/siws.js'
import nacl from 'tweetnacl'
import base58 from 'bs58'

describe('Cacao', () => {
  const ethWallet = Wallet.fromMnemonic(
    'despair voyage estate pizza main slice acquire mesh polar short desk lyrics'
  )
  const ethAddress = ethWallet.address

  const solanaSecretKey = new Uint8Array([
    146, 224, 142,  57, 174, 232, 125,  83, 254,  38,  57,
     19, 191, 157, 246,  97,  92,  28, 144, 152,  96, 161,
    211, 173,  87, 189,  14, 110,  46,  80, 113,  97, 236,
    191,  30,  45, 157, 168,  13,  58, 224, 157, 229,  76,
    231,  28, 191, 247,  35, 226, 145, 231, 164, 177,  51,
    206,  16, 153,  59, 229, 237, 250, 202,  80
  ]);

  const solanaWallet = solanaWeb3.Keypair.fromSecretKey(solanaSecretKey)

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
      address: solanaWallet.publicKey.toBase58(),
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
    const signature = base58.encode(nacl.sign.detached(signData, solanaWallet.secretKey))
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
      address: solanaWallet.publicKey.toBase58(),
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
