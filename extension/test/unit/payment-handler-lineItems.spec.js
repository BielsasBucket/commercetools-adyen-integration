const nock = require('nock')
const _ = require('lodash')
const sinon = require('sinon')
const { expect } = require('chai')
const { handlePayment } = require('../../src/paymentHandler/payment-handler')
const ctpPayment = require('./fixtures/ctp-payment.json')
const config = require('../../src/config/config')
const ctpCart = require('./fixtures/ctp-cart.json')
const paymentSuccessResponse = require('./fixtures/adyen-make-payment-success-response')

describe('payment-handler-lineItems::execute', () => {
  let scope

  const adyenMerchantAccount = config.getAllAdyenMerchantAccounts()[0]
  const commercetoolsProjectKey = config.getAllCtpProjectKeys()[0]

  let sandbox
  beforeEach(() => {
    const adyenConfig = config.getAdyenConfig(adyenMerchantAccount)
    scope = nock(`${adyenConfig.apiBaseUrl}`)
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    nock.cleanAll()
    sandbox.restore()
  })

  it(
    'when addCommercetoolsLineItems is enabled on app config and payment type that requires lineItems' +
      'then it should add lineItems to makePaymentRequest',
    async () => {
      _mockCtpCartsEndpoint()
      scope.post('/payments').reply(200, paymentSuccessResponse)

      const makePaymentRequest = {
        reference: 'YOUR_REFERENCE',
        paymentMethod: {
          type: 'clearpay',
        },
      }

      const ctpPaymentClone = _.cloneDeep(ctpPayment)
      ctpPaymentClone.custom.fields.makePaymentRequest =
        JSON.stringify(makePaymentRequest)
      ctpPaymentClone.custom.fields.adyenMerchantAccount = adyenMerchantAccount
      ctpPaymentClone.custom.fields.commercetoolsProjectKey =
        commercetoolsProjectKey

      sandbox.stub(config, 'getModuleConfig').returns({
        addCommercetoolsLineItems: true,
      })

      const response = await handlePayment(ctpPaymentClone)

      const makePaymentRequestInteraction = JSON.parse(
        response.actions.find((a) => a.action === 'addInterfaceInteraction')
          .fields.request
      )
      expect(makePaymentRequestInteraction.lineItems).to.have.lengthOf(3)
    }
  )

  it(
    'when addCommercetoolsLineItems set true on makePaymentRequest and payment type that does not require lineItems' +
      'then it should add lineItems to makePaymentRequest',
    async () => {
      _mockCtpCartsEndpoint()
      scope.post('/payments').reply(200, paymentSuccessResponse)

      const makePaymentRequest = {
        reference: 'YOUR_REFERENCE',
        paymentMethod: {
          type: 'gpay',
        },
        addCommercetoolsLineItems: true,
      }

      const ctpPaymentClone = _.cloneDeep(ctpPayment)
      ctpPaymentClone.custom.fields.makePaymentRequest =
        JSON.stringify(makePaymentRequest)
      ctpPaymentClone.custom.fields.adyenMerchantAccount = adyenMerchantAccount
      ctpPaymentClone.custom.fields.commercetoolsProjectKey =
        commercetoolsProjectKey

      sandbox.stub(config, 'getModuleConfig').returns({
        addCommercetoolsLineItems: false,
      })

      const response = await handlePayment(ctpPaymentClone)

      const makePaymentRequestInteraction = JSON.parse(
        response.actions.find((a) => a.action === 'addInterfaceInteraction')
          .fields.request
      )
      expect(makePaymentRequestInteraction.lineItems).to.have.lengthOf(3)
    }
  )

  it(
    'when addCommercetoolsLineItems set false on makePaymentRequest' +
      'then it should not add lineItems to makePaymentRequest',
    async () => {
      _mockCtpCartsEndpoint()
      scope.post('/payments').reply(200, paymentSuccessResponse)

      const makePaymentRequest = {
        reference: 'YOUR_REFERENCE',
        paymentMethod: {
          type: 'klarna',
        },
        addCommercetoolsLineItems: false,
      }

      const ctpPaymentClone = _.cloneDeep(ctpPayment)
      ctpPaymentClone.custom.fields.makePaymentRequest =
        JSON.stringify(makePaymentRequest)
      ctpPaymentClone.custom.fields.adyenMerchantAccount = adyenMerchantAccount
      ctpPaymentClone.custom.fields.commercetoolsProjectKey =
        commercetoolsProjectKey

      sandbox.stub(config, 'getModuleConfig').returns({
        addCommercetoolsLineItems: false,
      })

      const response = await handlePayment(ctpPaymentClone)
      const makePaymentRequestInteraction = JSON.parse(
        response.actions.find((a) => a.action === 'addInterfaceInteraction')
          .fields.request
      )
      expect(makePaymentRequestInteraction.lineItems).to.undefined
    }
  )

  it(
    'when addCommercetoolsLineItems is not enabled on app config, but makePaymentRequest for klarna payment type' +
      'then it should add lineItems to makePaymentRequest',
    async () => {
      _mockCtpCartsEndpoint()
      scope.post('/payments').reply(200, paymentSuccessResponse)

      const makePaymentRequest = {
        reference: 'YOUR_REFERENCE',
        paymentMethod: {
          type: 'klarna',
        },
      }

      const ctpPaymentClone = _.cloneDeep(ctpPayment)
      ctpPaymentClone.custom.fields.makePaymentRequest =
        JSON.stringify(makePaymentRequest)
      ctpPaymentClone.custom.fields.adyenMerchantAccount = adyenMerchantAccount
      ctpPaymentClone.custom.fields.commercetoolsProjectKey =
        commercetoolsProjectKey

      sandbox.stub(config, 'getModuleConfig').returns({
        addCommercetoolsLineItems: false,
      })

      const response = await handlePayment(ctpPaymentClone)
      const makePaymentRequestInteraction = JSON.parse(
        response.actions.find((a) => a.action === 'addInterfaceInteraction')
          .fields.request
      )
      expect(makePaymentRequestInteraction.lineItems).to.have.lengthOf(3)
    }
  )

  function _mockCtpCartsEndpoint(mockCart = ctpCart) {
    const ctpConfig = config.getCtpConfig(commercetoolsProjectKey)
    const ctpApiScope = nock(`${ctpConfig.apiUrl}`)
    const ctpAuthScope = nock(`${ctpConfig.authUrl}`)
    ctpAuthScope.post('/oauth/token').reply(200, {
      access_token: 'xxx',
      token_type: 'Bearer',
      expires_in: 172800,
      scope: 'manage_project:xxx',
    })
    ctpApiScope
      .get(`/${ctpConfig.projectKey}/carts`)
      .query(true)
      .reply(200, { results: [mockCart] })
  }
})
