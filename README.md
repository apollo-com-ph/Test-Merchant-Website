# Test Merchant Website

### Required env vars for deployment

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PAYCONNECT_API_BASE_URL` | Yes | `http://host.docker.internal:8080` | Base URL of the PayConnect Switch API used by `/testcheckout`. Set this per environment. |
| `PORT` | No | `3000` | HTTP port exposed by the container. Keep this as `3000` unless the service and ingress are changed too. |

### Notes

- No separate frontend environment variables are used.
- Current Kubernetes manifests already set `PORT=3000` and `PAYCONNECT_API_BASE_URL`.
- The app currently does not require `MERCHANT_RESPONSE_KEY` as a deployment env var; the response key is supplied in the checkout request payload.

## How to use the app

After the required env vars are set and the app is deployed:

1. Open the app root URL in a browser.
2. Enter the merchant public key, merchant response key, and mobile number.
3. Review or regenerate the merchant reference number.
4. Add one or more line items, then submit Checkout.
5. The app sends the checkout request to `PAYCONNECT_API_BASE_URL/v1/payments/checkout` and redirects the user to the PayConnect checkout page.
6. Configure PayConnect to send webhook events to `/webhook` on this app.
7. After a successful webhook, the app stores the callback and can show the success page for the transaction.

### Useful routes

| Route | Purpose |
| --- | --- |
| `/` | Checkout form UI for creating a test payment request. |
| `/webhook` | Receives PayConnect webhook callbacks. |
| `/callbacks` | Returns received callback count and callback logs as JSON. |
| `/reset3` | Resets in-memory callback logs and counters. |
| `/success/:transactionReferenceNumber` | Shows stored success details for a completed transaction. |
| `/success` | Simple success placeholder page. |
| `/fail` | Simple failure placeholder page. |

## Publish image

```sh
docker login harbor.am1-aks.apolloglobal.net
$imgName = "harbor.am1-aks.apolloglobal.net/payconnect-switch/test-merchant-website:1.0.0-test"
# docker build . -t $imgName -f Dockerfile.local
docker build . -t $imgName
docker push $imgName
```
