import { Wallet } from '@ethersproject/wallet'
import { Cacao, CacaoBlock } from '../cacao'
import { SiweMessage } from '../siwe'

describe('Cacao', () => {
  const wallet = Wallet.fromMnemonic(
    'despair voyage estate pizza main slice acquire mesh polar short desk lyrics'
  )
  const address = wallet.address

  test('Can create and verify Cacao Block', async () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: address,
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

    const signature = await wallet.signMessage(msg.toMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const block = await CacaoBlock.fromCacao(cacao)
    expect(block).toMatchSnapshot()

    expect(() => Cacao.verify(cacao)).not.toThrow()
  })

  test('Converts between Cacao and SiweMessage', () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: address,
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

  test('ok after exp if within phase out period', async () => {
    const fixedDate = new Date('2021-10-14T07:18:41Z')
    const msg = new SiweMessage({
      domain: 'service.org',
      address: address,
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

    const signature = await wallet.signMessage(msg.toMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const expiredTime = new Date(fixedDate.valueOf() + 10 * 1000)
    expect(() =>
      Cacao.verify(cacao, { atTime: expiredTime, revocationPhaseOutSecs: 20, clockSkewSecs: 0 })
    ).not.toThrow()
  })

  test('fail after exp if after phase out period', async () => {
    const fixedDate = new Date('2021-10-14T07:18:41Z')
    const msg = new SiweMessage({
      domain: 'service.org',
      address: address,
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

    const signature = await wallet.signMessage(msg.toMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const expiredTime = new Date(fixedDate.valueOf() + 10 * 1000)
    expect(() =>
      Cacao.verify(cacao, { atTime: expiredTime, revocationPhaseOutSecs: 1, clockSkewSecs: 0 })
    ).toThrow(`CACAO has expired`)
  })

  test('ok before IAT if within default clockskew', async () => {
    const fixedDate = new Date('2021-10-14T07:18:41Z')
    const msg = new SiweMessage({
      domain: 'service.org',
      address: address,
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: fixedDate.toISOString(),
      chainId: '1',
      resources: [
        'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
        'https://example.com/my-web2-claim.json',
      ],
    })

    const signature = await wallet.signMessage(msg.toMessage())
    msg.signature = signature

    const cacao = Cacao.fromSiweMessage(msg)
    const OneMinbeforeIAT = new Date(fixedDate.valueOf() - 60 * 1000)
    expect(() => Cacao.verify(cacao, { atTime: OneMinbeforeIAT })).not.toThrow()
  })
})
