import { describe, it, expect } from "vitest";
import { validateSdpOffer, extractMediaType, hasAudio, extractCodecs } from "./sdp";

describe("validateSdpOffer", () => {
  it("should validate valid SDP", () => {
    const sdp = "v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
    expect(validateSdpOffer(sdp)).toBe(true);
  });

  it("should reject invalid SDP", () => {
    expect(validateSdpOffer("invalid")).toBe(false);
    expect(validateSdpOffer("")).toBe(false);
  });
});

describe("extractMediaType", () => {
  it("should extract audio media type", () => {
    const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
    expect(extractMediaType(sdp)).toBe("audio");
  });

  it("should extract video media type", () => {
    const sdp = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
    expect(extractMediaType(sdp)).toBe("video");
  });

  it("should return null for no media", () => {
    const sdp = "v=0\r\n";
    expect(extractMediaType(sdp)).toBe(null);
  });
});

describe("hasAudio", () => {
  it("should detect audio in SDP", () => {
    const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
    expect(hasAudio(sdp)).toBe(true);
  });

  it("should return false when no audio", () => {
    const sdp = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
    expect(hasAudio(sdp)).toBe(false);
  });
});

describe("extractCodecs", () => {
  it("should extract codec names", () => {
    const sdp = "v=0\r\na=rtpmap:111 opus/48000/2\r\na=rtpmap:103 ISAC/16000\r\n";
    const codecs = extractCodecs(sdp);
    expect(codecs).toContain("opus/48000/2");
    expect(codecs).toContain("ISAC/16000");
  });

  it("should return empty array when no codecs", () => {
    const sdp = "v=0\r\n";
    const codecs = extractCodecs(sdp);
    expect(codecs).toEqual([]);
  });
});
