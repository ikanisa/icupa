variable "REGISTRY" {
  default = "ghcr.io"
}

variable "IMAGE_NAMESPACE" {
  default = "${GITHUB_REPOSITORY}" 
}

target "common" {
  context = "."
  cache-from = ["type=gha"]
  cache-to   = ["type=gha,mode=max"]
}

target "agents-service" {
  inherits = ["common"]
  dockerfile = "agents-service/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/agents-service:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/agents-service:${GITHUB_SHA}"
  ]
}

target "admin" {
  inherits = ["common"]
  dockerfile = "apps/admin/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/admin:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/admin:${GITHUB_SHA}"
  ]
}

target "client" {
  inherits = ["common"]
  dockerfile = "apps/client/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/client:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/client:${GITHUB_SHA}"
  ]
}

target "vendor" {
  inherits = ["common"]
  dockerfile = "apps/vendor/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/vendor:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/vendor:${GITHUB_SHA}"
  ]
}

target "web" {
  inherits = ["common"]
  dockerfile = "apps/web/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/web:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/web:${GITHUB_SHA}"
  ]
}

target "voice-agent" {
  inherits = ["common"]
  dockerfile = "apps/voice-agent/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/voice-agent:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/voice-agent:${GITHUB_SHA}"
  ]
}

target "ocr-converter" {
  inherits = ["common"]
  dockerfile = "apps/ocr-converter/Dockerfile"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/ocr-converter:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/ocr-converter:${GITHUB_SHA}"
  ]
}

target "ecotrips" {
  inherits = ["common"]
  dockerfile = "apps/ecotrips/Dockerfile.distroless"
  tags = [
    "${REGISTRY}/${IMAGE_NAMESPACE}/ecotrips:latest",
    "${REGISTRY}/${IMAGE_NAMESPACE}/ecotrips:${GITHUB_SHA}"
  ]
}

target "default" {
  inherits = [
    "agents-service",
    "admin",
    "client",
    "vendor",
    "web",
    "voice-agent",
    "ocr-converter",
    "ecotrips"
  ]
}
