import { SiweMessage } from '../siwx/siwe.js'
import { SignatureType } from '../siwx/siwx.js'
import { Wallet } from '@ethersproject/wallet'

describe('Message Generation', () => {
  test('With optional fields', () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
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

    expect(msg.toMessage()).toEqual(
      'service.org wants you to sign in with your Ethereum account:\n0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2\n\nI accept the ServiceOrg Terms of Service: https://service.org/tos\n\nURI: https://service.org/login\nVersion: 1\nNonce: 32891757\nIssued At: 2021-09-30T16:25:24.000Z\nChain ID: 1\nResources:\n- ipfs://Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu\n- https://example.com/my-web2-claim.json'
    )
  })

  test('No optional field', () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: '2021-09-30T16:25:24.000Z',
    })

    expect(msg.toMessage()).toEqual(
      'service.org wants you to sign in with your Ethereum account:\n0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2\n\nI accept the ServiceOrg Terms of Service: https://service.org/tos\n\nURI: https://service.org/login\nVersion: 1\nNonce: 32891757\nIssued At: 2021-09-30T16:25:24.000Z'
    )
  })

  test('Timestamp without microseconds', () => {
    const msg = new SiweMessage({
      domain: 'service.org',
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      statement: 'I accept the ServiceOrg Terms of Service: https://service.org/tos',
      uri: 'https://service.org/login',
      version: '1',
      nonce: '32891757',
      issuedAt: '2021-09-30T16:25:24Z',
    })

    expect(msg.toMessage()).toEqual(
      'service.org wants you to sign in with your Ethereum account:\n0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2\n\nI accept the ServiceOrg Terms of Service: https://service.org/tos\n\nURI: https://service.org/login\nVersion: 1\nNonce: 32891757\nIssued At: 2021-09-30T16:25:24Z'
    )
  })
})

describe('Ocap', () => {
  const wallet = Wallet.fromMnemonic(
    'despair voyage estate pizza main slice acquire mesh polar short desk lyrics'
  )

  test('Sign message using SiweMessage object', async () => {
    const address = wallet.address
    const fixedDate = new Date('2021-10-14T07:18:41Z')
    const msg = new SiweMessage({
      domain: 'self.id',
      statement: 'Give this app access to your streams',
      nonce: '12345678',
      type: SignatureType.PERSONAL_SIGNATURE,
      address: address,
      chainId: '1',
      issuedAt: fixedDate.toISOString(),
      resources: ['ceramic://bagcqcerakszw2vsovxznyp5gfnpdj4cqm2xiv76yd24wkjewhhykovorwo6a'],
      uri: `did:pkh:eip155:1:${address}`,
      version: '0.1',
    })
    expect(msg.toMessage()).toMatchSnapshot()

    const signature = await wallet.signMessage(msg.toMessage())
    expect(signature).toMatchSnapshot()
  })
})
