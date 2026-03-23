# Test Merchant Website

## Publish image

```sh
docker login harbor.am1-aks.apolloglobal.net
$imgName = "harbor.am1-aks.apolloglobal.net/payconnect-switch/test-merchant-website:1.0.0-test"
# docker build . -t $imgName -f Dockerfile.local
docker build . -t $imgName
docker push $imgName
```

### Required env vars for deployment

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PAYCONNECT_API_BASE_URL` | Yes | `http://host.docker.internal:8080` | Base URL of the PayConnect Switch API used by `/testcheckout`. Set this per environment. |
| `PORT` | No | `3000` | HTTP port exposed by the container. Keep this as `3000` unless the service and ingress are changed too. |

### Notes

- No separate frontend environment variables are used.
- Current Kubernetes manifests already set `PORT=3000` and `PAYCONNECT_API_BASE_URL`.
- The app currently does not require `MERCHANT_RESPONSE_KEY` as a deployment env var; the response key is supplied in the checkout request payload.
