FROM golang:latest

RUN apt-get update && \
    apt-get install -y \
    make \
    ca-certificates \
    openssl

# Add certificates needed to download go dependencies, taken from:
# https://stackoverflow.com/questions/64462922/docker-multi-stage-build-go-image-x509-certificate-signed-by-unknown-authorit
ARG cert_location=/usr/local/share/ca-certificates
RUN openssl s_client -showcerts -connect github.com:443 </dev/null 2>/dev/null|openssl x509 -outform PEM > ${cert_location}/github.crt
RUN openssl s_client -showcerts -connect proxy.golang.org:443 </dev/null 2>/dev/null|openssl x509 -outform PEM >  ${cert_location}/proxy.golang.crt
RUN update-ca-certificates

WORKDIR /server

COPY . .

RUN make build

EXPOSE 4242

CMD ["./bin/wikiweaver-server"]
