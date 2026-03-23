
to publish
```sh
docker login harbor.am1-aks.apolloglobal.net
$imgName = "harbor.am1-aks.apolloglobal.net/payconnect-switch/test-merchant-website:1.0.0-test"
# docker build . -t $imgName -f Dockerfile.local
docker build . -t $imgName
docker push $imgName
```