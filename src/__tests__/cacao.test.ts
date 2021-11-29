import { Wallet } from 'ethers'
import CACAO from '../cacao'
import { SiweMessage } from '../siwe'

describe('Cacao', () => {
  const wallet = Wallet.fromMnemonic(
    'despair voyage estate pizza main slice acquire mesh polar short desk lyrics'
  )
  const address = wallet.address

  test('Cacao block', async () => {
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

    const signature = await wallet.signMessage(msg.toMessage())
    msg.signature = signature

    const cacao = new CACAO(msg)
    const block = await cacao.toCacaoBlock()
    expect(block).toMatchSnapshot()
  })
})
