import { Wallet } from '@ethersproject/wallet'
import { Cacao, CacaoBlock } from '../cacao.js'
import { SiweMessage } from '../siwx/siwe.js'

const ISSUED_AT = new Date('2021-10-14T07:18:41Z')

const WALLET_MNEMONIC =
  'despair voyage estate pizza main slice acquire mesh polar short desk lyrics'
const ETHEREUM_WALLET = Wallet.fromMnemonic(WALLET_MNEMONIC)
const ETHEREUM_ADDRESS = ETHEREUM_WALLET.address
const SIWE_MESSAGE_PARAMS = {
  domain: 'service.org',
  address: ETHEREUM_ADDRESS,
  statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
  uri: 'did:key:z6MkrBdNdwUPnXDVD1DCxedzVVBpaGi8aSmoXFAeKNgtAer8',
  version: '1',
  nonce: '32891757',
  issuedAt: ISSUED_AT.toISOString(),
  chainId: '1',
  resources: [
    'ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
    'https://example.com/my-web2-claim.json',
  ],
}

test('Can create and verify Cacao Block for Ethereum', async () => {
  const msg = new SiweMessage(SIWE_MESSAGE_PARAMS)

  msg.signature = await ETHEREUM_WALLET.signMessage(msg.signMessage())

  const cacao = Cacao.fromSiweMessage(msg)
  const block = await CacaoBlock.fromCacao(cacao)
  expect(block).toMatchSnapshot()

  expect(() => Cacao.verify(cacao)).not.toThrow()
})

test('Converts between Cacao and SiweMessage', () => {
  const msg = new SiweMessage(SIWE_MESSAGE_PARAMS)

  const cacao = Cacao.fromSiweMessage(msg)
  const siwe = SiweMessage.fromCacao(cacao)
  expect(siwe).toEqual(msg)
})

test('ok after exp if within phase out period', async () => {
  const msg = new SiweMessage({
    ...SIWE_MESSAGE_PARAMS,
    expirationTime: new Date(ISSUED_AT.valueOf() + 5 * 1000).toISOString(),
  })

  msg.signature = await ETHEREUM_WALLET.signMessage(msg.toMessage())

  const cacao = Cacao.fromSiweMessage(msg)
  const expiredTime = new Date(ISSUED_AT.valueOf() + 10 * 1000)
  expect(() =>
    Cacao.verify(cacao, { atTime: expiredTime, revocationPhaseOutSecs: 20, clockSkewSecs: 0 })
  ).not.toThrow()
})

test('fail after exp if after phase out period', async () => {
  const msg = new SiweMessage({
    ...SIWE_MESSAGE_PARAMS,
    expirationTime: new Date(ISSUED_AT.valueOf() + 5 * 1000).toISOString(),
  })

  msg.signature = await ETHEREUM_WALLET.signMessage(msg.signMessage())

  const cacao = Cacao.fromSiweMessage(msg)
  const expiredTime = new Date(ISSUED_AT.valueOf() + 10 * 1000)
  expect(() =>
    Cacao.verify(cacao, { atTime: expiredTime, revocationPhaseOutSecs: 1, clockSkewSecs: 0 })
  ).toThrow(`CACAO has expired`)
})

test('ok before IAT if within default clockskew', async () => {
  const msg = new SiweMessage(SIWE_MESSAGE_PARAMS)

  msg.signature = await ETHEREUM_WALLET.signMessage(msg.toMessage())

  const cacao = Cacao.fromSiweMessage(msg)
  const OneMinbeforeIAT = new Date(ISSUED_AT.valueOf() - 60 * 1000)
  expect(() => Cacao.verify(cacao, { atTime: OneMinbeforeIAT })).not.toThrow()
})

test('ok after exp if disableTimecheck option', async () => {
  const msg = new SiweMessage({
    ...SIWE_MESSAGE_PARAMS,
    expirationTime: new Date(ISSUED_AT.valueOf() + 5 * 1000).toISOString(),
  })

  msg.signature = await ETHEREUM_WALLET.signMessage(msg.toMessage())

  const cacao = Cacao.fromSiweMessage(msg)
  expect(() =>
    Cacao.verify(cacao, {
      disableExpirationCheck: true,
      revocationPhaseOutSecs: 20,
      clockSkewSecs: 0,
    })
  ).not.toThrow()
})
