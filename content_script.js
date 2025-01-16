(() => {
  // node_modules/.pnpm/pbf@4.0.1/node_modules/pbf/index.js
  var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
  var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
  var TEXT_DECODER_MIN_LENGTH = 12;
  var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");
  var PBF_VARINT = 0;
  var PBF_FIXED64 = 1;
  var PBF_BYTES = 2;
  var PBF_FIXED32 = 5;
  var Pbf = class {
    /**
     * @param {Uint8Array | ArrayBuffer} [buf]
     */
    constructor(buf = new Uint8Array(16)) {
      this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
      this.dataView = new DataView(this.buf.buffer);
      this.pos = 0;
      this.type = 0;
      this.length = this.buf.length;
    }
    // === READING =================================================================
    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     * @param {number} [end]
     */
    readFields(readField, result, end = this.length) {
      while (this.pos < end) {
        const val = this.readVarint(), tag = val >> 3, startPos = this.pos;
        this.type = val & 7;
        readField(tag, result, this);
        if (this.pos === startPos) this.skip(val);
      }
      return result;
    }
    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     */
    readMessage(readField, result) {
      return this.readFields(readField, result, this.readVarint() + this.pos);
    }
    readFixed32() {
      const val = this.dataView.getUint32(this.pos, true);
      this.pos += 4;
      return val;
    }
    readSFixed32() {
      const val = this.dataView.getInt32(this.pos, true);
      this.pos += 4;
      return val;
    }
    // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
    readFixed64() {
      const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
      this.pos += 8;
      return val;
    }
    readSFixed64() {
      const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
      this.pos += 8;
      return val;
    }
    readFloat() {
      const val = this.dataView.getFloat32(this.pos, true);
      this.pos += 4;
      return val;
    }
    readDouble() {
      const val = this.dataView.getFloat64(this.pos, true);
      this.pos += 8;
      return val;
    }
    /**
     * @param {boolean} [isSigned]
     */
    readVarint(isSigned) {
      const buf = this.buf;
      let val, b;
      b = buf[this.pos++];
      val = b & 127;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 7;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 14;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 21;
      if (b < 128) return val;
      b = buf[this.pos];
      val |= (b & 15) << 28;
      return readVarintRemainder(val, isSigned, this);
    }
    readVarint64() {
      return this.readVarint(true);
    }
    readSVarint() {
      const num = this.readVarint();
      return num % 2 === 1 ? (num + 1) / -2 : num / 2;
    }
    readBoolean() {
      return Boolean(this.readVarint());
    }
    readString() {
      const end = this.readVarint() + this.pos;
      const pos = this.pos;
      this.pos = end;
      if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
        return utf8TextDecoder.decode(this.buf.subarray(pos, end));
      }
      return readUtf8(this.buf, pos, end);
    }
    readBytes() {
      const end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
      this.pos = end;
      return buffer;
    }
    // verbose for performance reasons; doesn't affect gzipped size
    /**
     * @param {number[]} [arr]
     * @param {boolean} [isSigned]
     */
    readPackedVarint(arr = [], isSigned) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readVarint(isSigned));
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSVarint(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSVarint());
      return arr;
    }
    /** @param {boolean[]} [arr] */
    readPackedBoolean(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readBoolean());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFloat(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFloat());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedDouble(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readDouble());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed32(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFixed32());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed32(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSFixed32());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed64(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFixed64());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed64(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSFixed64());
      return arr;
    }
    readPackedEnd() {
      return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
    }
    /** @param {number} val */
    skip(val) {
      const type = val & 7;
      if (type === PBF_VARINT) while (this.buf[this.pos++] > 127) {
      }
      else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
      else if (type === PBF_FIXED32) this.pos += 4;
      else if (type === PBF_FIXED64) this.pos += 8;
      else throw new Error(`Unimplemented type: ${type}`);
    }
    // === WRITING =================================================================
    /**
     * @param {number} tag
     * @param {number} type
     */
    writeTag(tag, type) {
      this.writeVarint(tag << 3 | type);
    }
    /** @param {number} min */
    realloc(min) {
      let length = this.length || 16;
      while (length < this.pos + min) length *= 2;
      if (length !== this.length) {
        const buf = new Uint8Array(length);
        buf.set(this.buf);
        this.buf = buf;
        this.dataView = new DataView(buf.buffer);
        this.length = length;
      }
    }
    finish() {
      this.length = this.pos;
      this.pos = 0;
      return this.buf.subarray(0, this.length);
    }
    /** @param {number} val */
    writeFixed32(val) {
      this.realloc(4);
      this.dataView.setInt32(this.pos, val, true);
      this.pos += 4;
    }
    /** @param {number} val */
    writeSFixed32(val) {
      this.realloc(4);
      this.dataView.setInt32(this.pos, val, true);
      this.pos += 4;
    }
    /** @param {number} val */
    writeFixed64(val) {
      this.realloc(8);
      this.dataView.setInt32(this.pos, val & -1, true);
      this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
      this.pos += 8;
    }
    /** @param {number} val */
    writeSFixed64(val) {
      this.realloc(8);
      this.dataView.setInt32(this.pos, val & -1, true);
      this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
      this.pos += 8;
    }
    /** @param {number} val */
    writeVarint(val) {
      val = +val || 0;
      if (val > 268435455 || val < 0) {
        writeBigVarint(val, this);
        return;
      }
      this.realloc(4);
      this.buf[this.pos++] = val & 127 | (val > 127 ? 128 : 0);
      if (val <= 127) return;
      this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
      if (val <= 127) return;
      this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
      if (val <= 127) return;
      this.buf[this.pos++] = val >>> 7 & 127;
    }
    /** @param {number} val */
    writeSVarint(val) {
      this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
    }
    /** @param {boolean} val */
    writeBoolean(val) {
      this.writeVarint(+val);
    }
    /** @param {string} str */
    writeString(str) {
      str = String(str);
      this.realloc(str.length * 4);
      this.pos++;
      const startPos = this.pos;
      this.pos = writeUtf8(this.buf, str, this.pos);
      const len = this.pos - startPos;
      if (len >= 128) makeRoomForExtraLength(startPos, len, this);
      this.pos = startPos - 1;
      this.writeVarint(len);
      this.pos += len;
    }
    /** @param {number} val */
    writeFloat(val) {
      this.realloc(4);
      this.dataView.setFloat32(this.pos, val, true);
      this.pos += 4;
    }
    /** @param {number} val */
    writeDouble(val) {
      this.realloc(8);
      this.dataView.setFloat64(this.pos, val, true);
      this.pos += 8;
    }
    /** @param {Uint8Array} buffer */
    writeBytes(buffer) {
      const len = buffer.length;
      this.writeVarint(len);
      this.realloc(len);
      for (let i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
    }
    /**
     * @template T
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeRawMessage(fn, obj) {
      this.pos++;
      const startPos = this.pos;
      fn(obj, this);
      const len = this.pos - startPos;
      if (len >= 128) makeRoomForExtraLength(startPos, len, this);
      this.pos = startPos - 1;
      this.writeVarint(len);
      this.pos += len;
    }
    /**
     * @template T
     * @param {number} tag
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeMessage(tag, fn, obj) {
      this.writeTag(tag, PBF_BYTES);
      this.writeRawMessage(fn, obj);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedVarint(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSVarint(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {boolean[]} arr
     */
    writePackedBoolean(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFloat(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedFloat, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedDouble(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedDouble, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed32(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed32(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed64(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed64(tag, arr) {
      if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr);
    }
    /**
     * @param {number} tag
     * @param {Uint8Array} buffer
     */
    writeBytesField(tag, buffer) {
      this.writeTag(tag, PBF_BYTES);
      this.writeBytes(buffer);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed32Field(tag, val) {
      this.writeTag(tag, PBF_FIXED32);
      this.writeFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed32Field(tag, val) {
      this.writeTag(tag, PBF_FIXED32);
      this.writeSFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed64Field(tag, val) {
      this.writeTag(tag, PBF_FIXED64);
      this.writeFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed64Field(tag, val) {
      this.writeTag(tag, PBF_FIXED64);
      this.writeSFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeVarintField(tag, val) {
      this.writeTag(tag, PBF_VARINT);
      this.writeVarint(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSVarintField(tag, val) {
      this.writeTag(tag, PBF_VARINT);
      this.writeSVarint(val);
    }
    /**
     * @param {number} tag
     * @param {string} str
     */
    writeStringField(tag, str) {
      this.writeTag(tag, PBF_BYTES);
      this.writeString(str);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFloatField(tag, val) {
      this.writeTag(tag, PBF_FIXED32);
      this.writeFloat(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeDoubleField(tag, val) {
      this.writeTag(tag, PBF_FIXED64);
      this.writeDouble(val);
    }
    /**
     * @param {number} tag
     * @param {boolean} val
     */
    writeBooleanField(tag, val) {
      this.writeVarintField(tag, +val);
    }
  };
  function readVarintRemainder(l, s, p) {
    const buf = p.buf;
    let h, b;
    b = buf[p.pos++];
    h = (b & 112) >> 4;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 3;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 10;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 17;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 24;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 1) << 31;
    if (b < 128) return toNum(l, h, s);
    throw new Error("Expected varint not more than 10 bytes");
  }
  function toNum(low, high, isSigned) {
    return isSigned ? high * 4294967296 + (low >>> 0) : (high >>> 0) * 4294967296 + (low >>> 0);
  }
  function writeBigVarint(val, pbf) {
    let low, high;
    if (val >= 0) {
      low = val % 4294967296 | 0;
      high = val / 4294967296 | 0;
    } else {
      low = ~(-val % 4294967296);
      high = ~(-val / 4294967296);
      if (low ^ 4294967295) {
        low = low + 1 | 0;
      } else {
        low = 0;
        high = high + 1 | 0;
      }
    }
    if (val >= 18446744073709552e3 || val < -18446744073709552e3) {
      throw new Error("Given varint doesn't fit into 10 bytes");
    }
    pbf.realloc(10);
    writeBigVarintLow(low, high, pbf);
    writeBigVarintHigh(high, pbf);
  }
  function writeBigVarintLow(low, high, pbf) {
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos++] = low & 127 | 128;
    low >>>= 7;
    pbf.buf[pbf.pos] = low & 127;
  }
  function writeBigVarintHigh(high, pbf) {
    const lsb = (high & 7) << 4;
    pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
    if (!high) return;
    pbf.buf[pbf.pos++] = high & 127;
  }
  function makeRoomForExtraLength(startPos, len, pbf) {
    const extraLen = len <= 16383 ? 1 : len <= 2097151 ? 2 : len <= 268435455 ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
    pbf.realloc(extraLen);
    for (let i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
  }
  function writePackedVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
  }
  function writePackedSVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
  }
  function writePackedFloat(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
  }
  function writePackedDouble(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
  }
  function writePackedBoolean(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
  }
  function writePackedFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
  }
  function writePackedSFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
  }
  function writePackedFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
  }
  function writePackedSFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
  }
  function readUtf8(buf, pos, end) {
    let str = "";
    let i = pos;
    while (i < end) {
      const b0 = buf[i];
      let c = null;
      let bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
      if (i + bytesPerSequence > end) break;
      let b1, b2, b3;
      if (bytesPerSequence === 1) {
        if (b0 < 128) {
          c = b0;
        }
      } else if (bytesPerSequence === 2) {
        b1 = buf[i + 1];
        if ((b1 & 192) === 128) {
          c = (b0 & 31) << 6 | b1 & 63;
          if (c <= 127) {
            c = null;
          }
        }
      } else if (bytesPerSequence === 3) {
        b1 = buf[i + 1];
        b2 = buf[i + 2];
        if ((b1 & 192) === 128 && (b2 & 192) === 128) {
          c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
          if (c <= 2047 || c >= 55296 && c <= 57343) {
            c = null;
          }
        }
      } else if (bytesPerSequence === 4) {
        b1 = buf[i + 1];
        b2 = buf[i + 2];
        b3 = buf[i + 3];
        if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
          c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
          if (c <= 65535 || c >= 1114112) {
            c = null;
          }
        }
      }
      if (c === null) {
        c = 65533;
        bytesPerSequence = 1;
      } else if (c > 65535) {
        c -= 65536;
        str += String.fromCharCode(c >>> 10 & 1023 | 55296);
        c = 56320 | c & 1023;
      }
      str += String.fromCharCode(c);
      i += bytesPerSequence;
    }
    return str;
  }
  function writeUtf8(buf, str, pos) {
    for (let i = 0, c, lead; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c > 55295 && c < 57344) {
        if (lead) {
          if (c < 56320) {
            buf[pos++] = 239;
            buf[pos++] = 191;
            buf[pos++] = 189;
            lead = c;
            continue;
          } else {
            c = lead - 55296 << 10 | c - 56320 | 65536;
            lead = null;
          }
        } else {
          if (c > 56319 || i + 1 === str.length) {
            buf[pos++] = 239;
            buf[pos++] = 191;
            buf[pos++] = 189;
          } else {
            lead = c;
          }
          continue;
        }
      } else if (lead) {
        buf[pos++] = 239;
        buf[pos++] = 191;
        buf[pos++] = 189;
        lead = null;
      }
      if (c < 128) {
        buf[pos++] = c;
      } else {
        if (c < 2048) {
          buf[pos++] = c >> 6 | 192;
        } else {
          if (c < 65536) {
            buf[pos++] = c >> 12 | 224;
          } else {
            buf[pos++] = c >> 18 | 240;
            buf[pos++] = c >> 12 & 63 | 128;
          }
          buf[pos++] = c >> 6 & 63 | 128;
        }
        buf[pos++] = c & 63 | 128;
      }
    }
    return pos;
  }

  // src/license_protocol.proto.js
  var LicenseType = self.LicenseType = {
    "STREAMING": {
      "value": 1,
      "options": {}
    },
    "OFFLINE": {
      "value": 2,
      "options": {}
    }
  };
  var ProtocolVersion = self.ProtocolVersion = {
    "VERSION_2_0": {
      "value": 20,
      "options": {}
    },
    "VERSION_2_1": {
      "value": 21,
      "options": {}
    }
  };
  var LicenseIdentification = self.LicenseIdentification = {};
  LicenseIdentification.read = function(pbf, end) {
    return pbf.readFields(LicenseIdentification._readField, { request_id: null, session_id: null, purchase_id: null, type: 0, version: 0, provider_session_token: null }, end);
  };
  LicenseIdentification._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.request_id = pbf.readBytes();
    else if (tag === 2) obj.session_id = pbf.readBytes();
    else if (tag === 3) obj.purchase_id = pbf.readBytes();
    else if (tag === 4) obj.type = pbf.readVarint();
    else if (tag === 5) obj.version = pbf.readVarint(true);
    else if (tag === 6) obj.provider_session_token = pbf.readBytes();
  };
  LicenseIdentification.write = function(obj, pbf) {
    if (obj.request_id) pbf.writeBytesField(1, obj.request_id);
    if (obj.session_id) pbf.writeBytesField(2, obj.session_id);
    if (obj.purchase_id) pbf.writeBytesField(3, obj.purchase_id);
    if (obj.type) pbf.writeVarintField(4, obj.type);
    if (obj.version) pbf.writeVarintField(5, obj.version);
    if (obj.provider_session_token) pbf.writeBytesField(6, obj.provider_session_token);
  };
  var License = self.License = {};
  License.read = function(pbf, end) {
    return pbf.readFields(License._readField, { id: null, policy: null, key: [], license_start_time: 0, remote_attestation_verified: false, provider_client_token: null }, end);
  };
  License._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.id = LicenseIdentification.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 2) obj.policy = License.Policy.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 3) obj.key.push(License.KeyContainer.read(pbf, pbf.readVarint() + pbf.pos));
    else if (tag === 4) obj.license_start_time = pbf.readVarint(true);
    else if (tag === 5) obj.remote_attestation_verified = pbf.readBoolean();
    else if (tag === 6) obj.provider_client_token = pbf.readBytes();
  };
  License.write = function(obj, pbf) {
    if (obj.id) pbf.writeMessage(1, LicenseIdentification.write, obj.id);
    if (obj.policy) pbf.writeMessage(2, License.Policy.write, obj.policy);
    if (obj.key) for (var i = 0; i < obj.key.length; i++) pbf.writeMessage(3, License.KeyContainer.write, obj.key[i]);
    if (obj.license_start_time) pbf.writeVarintField(4, obj.license_start_time);
    if (obj.remote_attestation_verified) pbf.writeBooleanField(5, obj.remote_attestation_verified);
    if (obj.provider_client_token) pbf.writeBytesField(6, obj.provider_client_token);
  };
  License.Policy = {};
  License.Policy.read = function(pbf, end) {
    return pbf.readFields(License.Policy._readField, { can_play: false, can_persist: false, can_renew: false, rental_duration_seconds: 0, playback_duration_seconds: 0, license_duration_seconds: 0, renewal_recovery_duration_seconds: 0, renewal_server_url: "", renewal_delay_seconds: 0, renewal_retry_interval_seconds: 0, renew_with_usage: false, renew_with_client_id: false }, end);
  };
  License.Policy._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.can_play = pbf.readBoolean();
    else if (tag === 2) obj.can_persist = pbf.readBoolean();
    else if (tag === 3) obj.can_renew = pbf.readBoolean();
    else if (tag === 4) obj.rental_duration_seconds = pbf.readVarint(true);
    else if (tag === 5) obj.playback_duration_seconds = pbf.readVarint(true);
    else if (tag === 6) obj.license_duration_seconds = pbf.readVarint(true);
    else if (tag === 7) obj.renewal_recovery_duration_seconds = pbf.readVarint(true);
    else if (tag === 8) obj.renewal_server_url = pbf.readString();
    else if (tag === 9) obj.renewal_delay_seconds = pbf.readVarint(true);
    else if (tag === 10) obj.renewal_retry_interval_seconds = pbf.readVarint(true);
    else if (tag === 11) obj.renew_with_usage = pbf.readBoolean();
    else if (tag === 12) obj.renew_with_client_id = pbf.readBoolean();
  };
  License.Policy.write = function(obj, pbf) {
    if (obj.can_play) pbf.writeBooleanField(1, obj.can_play);
    if (obj.can_persist) pbf.writeBooleanField(2, obj.can_persist);
    if (obj.can_renew) pbf.writeBooleanField(3, obj.can_renew);
    if (obj.rental_duration_seconds) pbf.writeVarintField(4, obj.rental_duration_seconds);
    if (obj.playback_duration_seconds) pbf.writeVarintField(5, obj.playback_duration_seconds);
    if (obj.license_duration_seconds) pbf.writeVarintField(6, obj.license_duration_seconds);
    if (obj.renewal_recovery_duration_seconds) pbf.writeVarintField(7, obj.renewal_recovery_duration_seconds);
    if (obj.renewal_server_url) pbf.writeStringField(8, obj.renewal_server_url);
    if (obj.renewal_delay_seconds) pbf.writeVarintField(9, obj.renewal_delay_seconds);
    if (obj.renewal_retry_interval_seconds) pbf.writeVarintField(10, obj.renewal_retry_interval_seconds);
    if (obj.renew_with_usage) pbf.writeBooleanField(11, obj.renew_with_usage);
    if (obj.renew_with_client_id) pbf.writeBooleanField(12, obj.renew_with_client_id);
  };
  License.KeyContainer = {};
  License.KeyContainer.read = function(pbf, end) {
    return pbf.readFields(License.KeyContainer._readField, { id: null, iv: null, key: null, type: 0, level: { "value": 1, "options": {} }, required_protection: null, requested_protection: null, key_control: null, operator_session_key_permissions: null, video_resolution_constraints: [], anti_rollback_usage_table: false }, end);
  };
  License.KeyContainer._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.id = pbf.readBytes();
    else if (tag === 2) obj.iv = pbf.readBytes();
    else if (tag === 3) obj.key = pbf.readBytes();
    else if (tag === 4) obj.type = pbf.readVarint();
    else if (tag === 5) obj.level = pbf.readVarint();
    else if (tag === 6) obj.required_protection = License.KeyContainer.OutputProtection.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 7) obj.requested_protection = License.KeyContainer.OutputProtection.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 8) obj.key_control = License.KeyContainer.KeyControl.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 9) obj.operator_session_key_permissions = License.KeyContainer.OperatorSessionKeyPermissions.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 10) obj.video_resolution_constraints.push(License.KeyContainer.VideoResolutionConstraint.read(pbf, pbf.readVarint() + pbf.pos));
    else if (tag === 11) obj.anti_rollback_usage_table = pbf.readBoolean();
  };
  License.KeyContainer.write = function(obj, pbf) {
    if (obj.id) pbf.writeBytesField(1, obj.id);
    if (obj.iv) pbf.writeBytesField(2, obj.iv);
    if (obj.key) pbf.writeBytesField(3, obj.key);
    if (obj.type) pbf.writeVarintField(4, obj.type);
    if (obj.level != void 0 && obj.level !== { "value": 1, "options": {} }) pbf.writeVarintField(5, obj.level);
    if (obj.required_protection) pbf.writeMessage(6, License.KeyContainer.OutputProtection.write, obj.required_protection);
    if (obj.requested_protection) pbf.writeMessage(7, License.KeyContainer.OutputProtection.write, obj.requested_protection);
    if (obj.key_control) pbf.writeMessage(8, License.KeyContainer.KeyControl.write, obj.key_control);
    if (obj.operator_session_key_permissions) pbf.writeMessage(9, License.KeyContainer.OperatorSessionKeyPermissions.write, obj.operator_session_key_permissions);
    if (obj.video_resolution_constraints) for (var i = 0; i < obj.video_resolution_constraints.length; i++) pbf.writeMessage(10, License.KeyContainer.VideoResolutionConstraint.write, obj.video_resolution_constraints[i]);
    if (obj.anti_rollback_usage_table) pbf.writeBooleanField(11, obj.anti_rollback_usage_table);
  };
  License.KeyContainer.KeyType = {
    "SIGNING": {
      "value": 1,
      "options": {}
    },
    "CONTENT": {
      "value": 2,
      "options": {}
    },
    "KEY_CONTROL": {
      "value": 3,
      "options": {}
    },
    "OPERATOR_SESSION": {
      "value": 4,
      "options": {}
    }
  };
  License.KeyContainer.SecurityLevel = {
    "SW_SECURE_CRYPTO": {
      "value": 1,
      "options": {}
    },
    "SW_SECURE_DECODE": {
      "value": 2,
      "options": {}
    },
    "HW_SECURE_CRYPTO": {
      "value": 3,
      "options": {}
    },
    "HW_SECURE_DECODE": {
      "value": 4,
      "options": {}
    },
    "HW_SECURE_ALL": {
      "value": 5,
      "options": {}
    }
  };
  License.KeyContainer.KeyControl = {};
  License.KeyContainer.KeyControl.read = function(pbf, end) {
    return pbf.readFields(License.KeyContainer.KeyControl._readField, { key_control_block: null, iv: null }, end);
  };
  License.KeyContainer.KeyControl._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.key_control_block = pbf.readBytes();
    else if (tag === 2) obj.iv = pbf.readBytes();
  };
  License.KeyContainer.KeyControl.write = function(obj, pbf) {
    if (obj.key_control_block) pbf.writeBytesField(1, obj.key_control_block);
    if (obj.iv) pbf.writeBytesField(2, obj.iv);
  };
  License.KeyContainer.OutputProtection = {};
  License.KeyContainer.OutputProtection.read = function(pbf, end) {
    return pbf.readFields(License.KeyContainer.OutputProtection._readField, { hdcp: { "value": 0, "options": {} }, cgms_flags: { "value": 42, "options": {} } }, end);
  };
  License.KeyContainer.OutputProtection._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.hdcp = pbf.readVarint();
    else if (tag === 2) obj.cgms_flags = pbf.readVarint();
  };
  License.KeyContainer.OutputProtection.write = function(obj, pbf) {
    if (obj.hdcp != void 0 && obj.hdcp !== { "value": 0, "options": {} }) pbf.writeVarintField(1, obj.hdcp);
    if (obj.cgms_flags != void 0 && obj.cgms_flags !== { "value": 42, "options": {} }) pbf.writeVarintField(2, obj.cgms_flags);
  };
  License.KeyContainer.OutputProtection.HDCP = {
    "HDCP_NONE": {
      "value": 0,
      "options": {}
    },
    "HDCP_V1": {
      "value": 1,
      "options": {}
    },
    "HDCP_V2": {
      "value": 2,
      "options": {}
    },
    "HDCP_V2_1": {
      "value": 3,
      "options": {}
    },
    "HDCP_V2_2": {
      "value": 4,
      "options": {}
    },
    "HDCP_NO_DIGITAL_OUTPUT": {
      "value": 255,
      "options": {}
    }
  };
  License.KeyContainer.OutputProtection.CGMS = {
    "CGMS_NONE": {
      "value": 42,
      "options": {}
    },
    "COPY_FREE": {
      "value": 0,
      "options": {}
    },
    "COPY_ONCE": {
      "value": 2,
      "options": {}
    },
    "COPY_NEVER": {
      "value": 3,
      "options": {}
    }
  };
  License.KeyContainer.VideoResolutionConstraint = {};
  License.KeyContainer.VideoResolutionConstraint.read = function(pbf, end) {
    return pbf.readFields(License.KeyContainer.VideoResolutionConstraint._readField, { min_resolution_pixels: 0, max_resolution_pixels: 0, required_protection: null }, end);
  };
  License.KeyContainer.VideoResolutionConstraint._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.min_resolution_pixels = pbf.readVarint();
    else if (tag === 2) obj.max_resolution_pixels = pbf.readVarint();
    else if (tag === 3) obj.required_protection = License.KeyContainer.OutputProtection.read(pbf, pbf.readVarint() + pbf.pos);
  };
  License.KeyContainer.VideoResolutionConstraint.write = function(obj, pbf) {
    if (obj.min_resolution_pixels) pbf.writeVarintField(1, obj.min_resolution_pixels);
    if (obj.max_resolution_pixels) pbf.writeVarintField(2, obj.max_resolution_pixels);
    if (obj.required_protection) pbf.writeMessage(3, License.KeyContainer.OutputProtection.write, obj.required_protection);
  };
  License.KeyContainer.OperatorSessionKeyPermissions = {};
  License.KeyContainer.OperatorSessionKeyPermissions.read = function(pbf, end) {
    return pbf.readFields(License.KeyContainer.OperatorSessionKeyPermissions._readField, { allow_encrypt: false, allow_decrypt: false, allow_sign: false, allow_signature_verify: false }, end);
  };
  License.KeyContainer.OperatorSessionKeyPermissions._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.allow_encrypt = pbf.readBoolean();
    else if (tag === 2) obj.allow_decrypt = pbf.readBoolean();
    else if (tag === 3) obj.allow_sign = pbf.readBoolean();
    else if (tag === 4) obj.allow_signature_verify = pbf.readBoolean();
  };
  License.KeyContainer.OperatorSessionKeyPermissions.write = function(obj, pbf) {
    if (obj.allow_encrypt) pbf.writeBooleanField(1, obj.allow_encrypt);
    if (obj.allow_decrypt) pbf.writeBooleanField(2, obj.allow_decrypt);
    if (obj.allow_sign) pbf.writeBooleanField(3, obj.allow_sign);
    if (obj.allow_signature_verify) pbf.writeBooleanField(4, obj.allow_signature_verify);
  };
  var LicenseRequest = self.LicenseRequest = {};
  LicenseRequest.read = function(pbf, end) {
    return pbf.readFields(LicenseRequest._readField, { client_id: null, content_id: null, type: 0, request_time: 0, key_control_nonce_deprecated: null, protocol_version: { "value": 20, "options": {} }, key_control_nonce: 0, encrypted_client_id: null }, end);
  };
  LicenseRequest._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.client_id = ClientIdentification.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 2) obj.content_id = LicenseRequest.ContentIdentification.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 3) obj.type = pbf.readVarint();
    else if (tag === 4) obj.request_time = pbf.readVarint(true);
    else if (tag === 5) obj.key_control_nonce_deprecated = pbf.readBytes();
    else if (tag === 6) obj.protocol_version = pbf.readVarint();
    else if (tag === 7) obj.key_control_nonce = pbf.readVarint();
    else if (tag === 8) obj.encrypted_client_id = EncryptedClientIdentification.read(pbf, pbf.readVarint() + pbf.pos);
  };
  LicenseRequest.write = function(obj, pbf) {
    if (obj.client_id) pbf.writeMessage(1, ClientIdentification.write, obj.client_id);
    if (obj.content_id) pbf.writeMessage(2, LicenseRequest.ContentIdentification.write, obj.content_id);
    if (obj.type) pbf.writeVarintField(3, obj.type);
    if (obj.request_time) pbf.writeVarintField(4, obj.request_time);
    if (obj.key_control_nonce_deprecated) pbf.writeBytesField(5, obj.key_control_nonce_deprecated);
    if (obj.protocol_version != void 0 && obj.protocol_version !== { "value": 20, "options": {} }) pbf.writeVarintField(6, obj.protocol_version);
    if (obj.key_control_nonce) pbf.writeVarintField(7, obj.key_control_nonce);
    if (obj.encrypted_client_id) pbf.writeMessage(8, EncryptedClientIdentification.write, obj.encrypted_client_id);
  };
  LicenseRequest.RequestType = {
    "NEW": {
      "value": 1,
      "options": {}
    },
    "RENEWAL": {
      "value": 2,
      "options": {}
    },
    "RELEASE": {
      "value": 3,
      "options": {}
    }
  };
  LicenseRequest.ContentIdentification = {};
  LicenseRequest.ContentIdentification.read = function(pbf, end) {
    return pbf.readFields(LicenseRequest.ContentIdentification._readField, { cenc_id: null, webm_id: null, license: null }, end);
  };
  LicenseRequest.ContentIdentification._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.cenc_id = LicenseRequest.ContentIdentification.CENC.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 2) obj.webm_id = LicenseRequest.ContentIdentification.WebM.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 3) obj.license = LicenseRequest.ContentIdentification.ExistingLicense.read(pbf, pbf.readVarint() + pbf.pos);
  };
  LicenseRequest.ContentIdentification.write = function(obj, pbf) {
    if (obj.cenc_id) pbf.writeMessage(1, LicenseRequest.ContentIdentification.CENC.write, obj.cenc_id);
    if (obj.webm_id) pbf.writeMessage(2, LicenseRequest.ContentIdentification.WebM.write, obj.webm_id);
    if (obj.license) pbf.writeMessage(3, LicenseRequest.ContentIdentification.ExistingLicense.write, obj.license);
  };
  LicenseRequest.ContentIdentification.CENC = {};
  LicenseRequest.ContentIdentification.CENC.read = function(pbf, end) {
    return pbf.readFields(LicenseRequest.ContentIdentification.CENC._readField, { pssh: [], license_type: 0, request_id: null }, end);
  };
  LicenseRequest.ContentIdentification.CENC._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.pssh.push(pbf.readBytes());
    else if (tag === 2) obj.license_type = pbf.readVarint();
    else if (tag === 3) obj.request_id = pbf.readBytes();
  };
  LicenseRequest.ContentIdentification.CENC.write = function(obj, pbf) {
    if (obj.pssh) for (var i = 0; i < obj.pssh.length; i++) pbf.writeBytesField(1, obj.pssh[i]);
    if (obj.license_type) pbf.writeVarintField(2, obj.license_type);
    if (obj.request_id) pbf.writeBytesField(3, obj.request_id);
  };
  LicenseRequest.ContentIdentification.WebM = {};
  LicenseRequest.ContentIdentification.WebM.read = function(pbf, end) {
    return pbf.readFields(LicenseRequest.ContentIdentification.WebM._readField, { header: null, license_type: 0, request_id: null }, end);
  };
  LicenseRequest.ContentIdentification.WebM._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.header = pbf.readBytes();
    else if (tag === 2) obj.license_type = pbf.readVarint();
    else if (tag === 3) obj.request_id = pbf.readBytes();
  };
  LicenseRequest.ContentIdentification.WebM.write = function(obj, pbf) {
    if (obj.header) pbf.writeBytesField(1, obj.header);
    if (obj.license_type) pbf.writeVarintField(2, obj.license_type);
    if (obj.request_id) pbf.writeBytesField(3, obj.request_id);
  };
  LicenseRequest.ContentIdentification.ExistingLicense = {};
  LicenseRequest.ContentIdentification.ExistingLicense.read = function(pbf, end) {
    return pbf.readFields(LicenseRequest.ContentIdentification.ExistingLicense._readField, { license_id: null, seconds_since_started: 0, seconds_since_last_played: 0, session_usage_table_entry: null }, end);
  };
  LicenseRequest.ContentIdentification.ExistingLicense._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.license_id = LicenseIdentification.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 2) obj.seconds_since_started = pbf.readVarint(true);
    else if (tag === 3) obj.seconds_since_last_played = pbf.readVarint(true);
    else if (tag === 4) obj.session_usage_table_entry = pbf.readBytes();
  };
  LicenseRequest.ContentIdentification.ExistingLicense.write = function(obj, pbf) {
    if (obj.license_id) pbf.writeMessage(1, LicenseIdentification.write, obj.license_id);
    if (obj.seconds_since_started) pbf.writeVarintField(2, obj.seconds_since_started);
    if (obj.seconds_since_last_played) pbf.writeVarintField(3, obj.seconds_since_last_played);
    if (obj.session_usage_table_entry) pbf.writeBytesField(4, obj.session_usage_table_entry);
  };
  var LicenseError = self.LicenseError = {};
  LicenseError.read = function(pbf, end) {
    return pbf.readFields(LicenseError._readField, { error_code: 0 }, end);
  };
  LicenseError._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.error_code = pbf.readVarint();
  };
  LicenseError.write = function(obj, pbf) {
    if (obj.error_code) pbf.writeVarintField(1, obj.error_code);
  };
  LicenseError.Error = {
    "INVALID_DEVICE_CERTIFICATE": {
      "value": 1,
      "options": {}
    },
    "REVOKED_DEVICE_CERTIFICATE": {
      "value": 2,
      "options": {}
    },
    "SERVICE_UNAVAILABLE": {
      "value": 3,
      "options": {}
    }
  };
  var RemoteAttestation = self.RemoteAttestation = {};
  RemoteAttestation.read = function(pbf, end) {
    return pbf.readFields(RemoteAttestation._readField, { certificate: null, salt: null, signature: null }, end);
  };
  RemoteAttestation._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.certificate = EncryptedClientIdentification.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 2) obj.salt = pbf.readBytes();
    else if (tag === 3) obj.signature = pbf.readBytes();
  };
  RemoteAttestation.write = function(obj, pbf) {
    if (obj.certificate) pbf.writeMessage(1, EncryptedClientIdentification.write, obj.certificate);
    if (obj.salt) pbf.writeBytesField(2, obj.salt);
    if (obj.signature) pbf.writeBytesField(3, obj.signature);
  };
  var SignedMessage = self.SignedMessage = {};
  SignedMessage.read = function(pbf, end) {
    return pbf.readFields(SignedMessage._readField, { type: 0, msg: null, signature: null, session_key: null, remote_attestation: null }, end);
  };
  SignedMessage._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.type = pbf.readVarint();
    else if (tag === 2) obj.msg = pbf.readBytes();
    else if (tag === 3) obj.signature = pbf.readBytes();
    else if (tag === 4) obj.session_key = pbf.readBytes();
    else if (tag === 5) obj.remote_attestation = RemoteAttestation.read(pbf, pbf.readVarint() + pbf.pos);
  };
  SignedMessage.write = function(obj, pbf) {
    if (obj.type) pbf.writeVarintField(1, obj.type);
    if (obj.msg) pbf.writeBytesField(2, obj.msg);
    if (obj.signature) pbf.writeBytesField(3, obj.signature);
    if (obj.session_key) pbf.writeBytesField(4, obj.session_key);
    if (obj.remote_attestation) pbf.writeMessage(5, RemoteAttestation.write, obj.remote_attestation);
  };
  SignedMessage.MessageType = {
    "LICENSE_REQUEST": {
      "value": 1,
      "options": {}
    },
    "LICENSE": {
      "value": 2,
      "options": {}
    },
    "ERROR_RESPONSE": {
      "value": 3,
      "options": {}
    },
    "SERVICE_CERTIFICATE_REQUEST": {
      "value": 4,
      "options": {}
    },
    "SERVICE_CERTIFICATE": {
      "value": 5,
      "options": {}
    }
  };
  var ProvisioningOptions = self.ProvisioningOptions = {};
  ProvisioningOptions.read = function(pbf, end) {
    return pbf.readFields(ProvisioningOptions._readField, { certificate_type: 0, certificate_authority: "" }, end);
  };
  ProvisioningOptions._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.certificate_type = pbf.readVarint();
    else if (tag === 2) obj.certificate_authority = pbf.readString();
  };
  ProvisioningOptions.write = function(obj, pbf) {
    if (obj.certificate_type) pbf.writeVarintField(1, obj.certificate_type);
    if (obj.certificate_authority) pbf.writeStringField(2, obj.certificate_authority);
  };
  ProvisioningOptions.CertificateType = {
    "WIDEVINE_DRM": {
      "value": 0,
      "options": {}
    },
    "X509": {
      "value": 1,
      "options": {}
    }
  };
  var ProvisioningRequest = self.ProvisioningRequest = {};
  ProvisioningRequest.read = function(pbf, end) {
    return pbf.readFields(ProvisioningRequest._readField, { client_id: null, nonce: null, options: null, stable_id: null }, end);
  };
  ProvisioningRequest._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.client_id = ClientIdentification.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 2) obj.nonce = pbf.readBytes();
    else if (tag === 3) obj.options = ProvisioningOptions.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 4) obj.stable_id = pbf.readBytes();
  };
  ProvisioningRequest.write = function(obj, pbf) {
    if (obj.client_id) pbf.writeMessage(1, ClientIdentification.write, obj.client_id);
    if (obj.nonce) pbf.writeBytesField(2, obj.nonce);
    if (obj.options) pbf.writeMessage(3, ProvisioningOptions.write, obj.options);
    if (obj.stable_id) pbf.writeBytesField(4, obj.stable_id);
  };
  var ProvisioningResponse = self.ProvisioningResponse = {};
  ProvisioningResponse.read = function(pbf, end) {
    return pbf.readFields(ProvisioningResponse._readField, { device_rsa_key: null, device_rsa_key_iv: null, device_certificate: null, nonce: null }, end);
  };
  ProvisioningResponse._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.device_rsa_key = pbf.readBytes();
    else if (tag === 2) obj.device_rsa_key_iv = pbf.readBytes();
    else if (tag === 3) obj.device_certificate = pbf.readBytes();
    else if (tag === 4) obj.nonce = pbf.readBytes();
  };
  ProvisioningResponse.write = function(obj, pbf) {
    if (obj.device_rsa_key) pbf.writeBytesField(1, obj.device_rsa_key);
    if (obj.device_rsa_key_iv) pbf.writeBytesField(2, obj.device_rsa_key_iv);
    if (obj.device_certificate) pbf.writeBytesField(3, obj.device_certificate);
    if (obj.nonce) pbf.writeBytesField(4, obj.nonce);
  };
  var SignedProvisioningMessage = self.SignedProvisioningMessage = {};
  SignedProvisioningMessage.read = function(pbf, end) {
    return pbf.readFields(SignedProvisioningMessage._readField, { message: null, signature: null }, end);
  };
  SignedProvisioningMessage._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.message = pbf.readBytes();
    else if (tag === 2) obj.signature = pbf.readBytes();
  };
  SignedProvisioningMessage.write = function(obj, pbf) {
    if (obj.message) pbf.writeBytesField(1, obj.message);
    if (obj.signature) pbf.writeBytesField(2, obj.signature);
  };
  var ClientIdentification = self.ClientIdentification = {};
  ClientIdentification.read = function(pbf, end) {
    return pbf.readFields(ClientIdentification._readField, { type: { "value": 0, "options": {} }, token: null, client_info: [], provider_client_token: null, license_counter: 0, client_capabilities: null }, end);
  };
  ClientIdentification._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.type = pbf.readVarint();
    else if (tag === 2) obj.token = pbf.readBytes();
    else if (tag === 3) obj.client_info.push(ClientIdentification.NameValue.read(pbf, pbf.readVarint() + pbf.pos));
    else if (tag === 4) obj.provider_client_token = pbf.readBytes();
    else if (tag === 5) obj.license_counter = pbf.readVarint();
    else if (tag === 6) obj.client_capabilities = ClientIdentification.ClientCapabilities.read(pbf, pbf.readVarint() + pbf.pos);
  };
  ClientIdentification.write = function(obj, pbf) {
    if (obj.type != void 0 && obj.type !== { "value": 0, "options": {} }) pbf.writeVarintField(1, obj.type);
    if (obj.token) pbf.writeBytesField(2, obj.token);
    if (obj.client_info) for (var i = 0; i < obj.client_info.length; i++) pbf.writeMessage(3, ClientIdentification.NameValue.write, obj.client_info[i]);
    if (obj.provider_client_token) pbf.writeBytesField(4, obj.provider_client_token);
    if (obj.license_counter) pbf.writeVarintField(5, obj.license_counter);
    if (obj.client_capabilities) pbf.writeMessage(6, ClientIdentification.ClientCapabilities.write, obj.client_capabilities);
  };
  ClientIdentification.TokenType = {
    "KEYBOX": {
      "value": 0,
      "options": {}
    },
    "DEVICE_CERTIFICATE": {
      "value": 1,
      "options": {}
    },
    "REMOTE_ATTESTATION_CERTIFICATE": {
      "value": 2,
      "options": {}
    }
  };
  ClientIdentification.NameValue = {};
  ClientIdentification.NameValue.read = function(pbf, end) {
    return pbf.readFields(ClientIdentification.NameValue._readField, { name: "", value: "" }, end);
  };
  ClientIdentification.NameValue._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.name = pbf.readString();
    else if (tag === 2) obj.value = pbf.readString();
  };
  ClientIdentification.NameValue.write = function(obj, pbf) {
    if (obj.name) pbf.writeStringField(1, obj.name);
    if (obj.value) pbf.writeStringField(2, obj.value);
  };
  ClientIdentification.ClientCapabilities = {};
  ClientIdentification.ClientCapabilities.read = function(pbf, end) {
    return pbf.readFields(ClientIdentification.ClientCapabilities._readField, { client_token: false, session_token: false, video_resolution_constraints: false, max_hdcp_version: { "value": 0, "options": {} }, oem_crypto_api_version: 0, anti_rollback_usage_table: false }, end);
  };
  ClientIdentification.ClientCapabilities._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.client_token = pbf.readBoolean();
    else if (tag === 2) obj.session_token = pbf.readBoolean();
    else if (tag === 3) obj.video_resolution_constraints = pbf.readBoolean();
    else if (tag === 4) obj.max_hdcp_version = pbf.readVarint();
    else if (tag === 5) obj.oem_crypto_api_version = pbf.readVarint();
    else if (tag === 6) obj.anti_rollback_usage_table = pbf.readBoolean();
  };
  ClientIdentification.ClientCapabilities.write = function(obj, pbf) {
    if (obj.client_token) pbf.writeBooleanField(1, obj.client_token);
    if (obj.session_token) pbf.writeBooleanField(2, obj.session_token);
    if (obj.video_resolution_constraints) pbf.writeBooleanField(3, obj.video_resolution_constraints);
    if (obj.max_hdcp_version != void 0 && obj.max_hdcp_version !== { "value": 0, "options": {} }) pbf.writeVarintField(4, obj.max_hdcp_version);
    if (obj.oem_crypto_api_version) pbf.writeVarintField(5, obj.oem_crypto_api_version);
    if (obj.anti_rollback_usage_table) pbf.writeBooleanField(6, obj.anti_rollback_usage_table);
  };
  ClientIdentification.ClientCapabilities.HdcpVersion = {
    "HDCP_NONE": {
      "value": 0,
      "options": {}
    },
    "HDCP_V1": {
      "value": 1,
      "options": {}
    },
    "HDCP_V2": {
      "value": 2,
      "options": {}
    },
    "HDCP_V2_1": {
      "value": 3,
      "options": {}
    },
    "HDCP_V2_2": {
      "value": 4,
      "options": {}
    },
    "HDCP_NO_DIGITAL_OUTPUT": {
      "value": 255,
      "options": {}
    }
  };
  var EncryptedClientIdentification = self.EncryptedClientIdentification = {};
  EncryptedClientIdentification.read = function(pbf, end) {
    return pbf.readFields(EncryptedClientIdentification._readField, { service_id: "", service_certificate_serial_number: null, encrypted_client_id: null, encrypted_client_id_iv: null, encrypted_privacy_key: null }, end);
  };
  EncryptedClientIdentification._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.service_id = pbf.readString();
    else if (tag === 2) obj.service_certificate_serial_number = pbf.readBytes();
    else if (tag === 3) obj.encrypted_client_id = pbf.readBytes();
    else if (tag === 4) obj.encrypted_client_id_iv = pbf.readBytes();
    else if (tag === 5) obj.encrypted_privacy_key = pbf.readBytes();
  };
  EncryptedClientIdentification.write = function(obj, pbf) {
    if (obj.service_id) pbf.writeStringField(1, obj.service_id);
    if (obj.service_certificate_serial_number) pbf.writeBytesField(2, obj.service_certificate_serial_number);
    if (obj.encrypted_client_id) pbf.writeBytesField(3, obj.encrypted_client_id);
    if (obj.encrypted_client_id_iv) pbf.writeBytesField(4, obj.encrypted_client_id_iv);
    if (obj.encrypted_privacy_key) pbf.writeBytesField(5, obj.encrypted_privacy_key);
  };
  var DeviceCertificate = self.DeviceCertificate = {};
  DeviceCertificate.read = function(pbf, end) {
    return pbf.readFields(DeviceCertificate._readField, { type: 0, serial_number: null, creation_time_seconds: 0, public_key: null, system_id: 0, test_device_deprecated: false, service_id: "" }, end);
  };
  DeviceCertificate._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.type = pbf.readVarint();
    else if (tag === 2) obj.serial_number = pbf.readBytes();
    else if (tag === 3) obj.creation_time_seconds = pbf.readVarint();
    else if (tag === 4) obj.public_key = pbf.readBytes();
    else if (tag === 5) obj.system_id = pbf.readVarint();
    else if (tag === 6) obj.test_device_deprecated = pbf.readBoolean();
    else if (tag === 7) obj.service_id = pbf.readString();
  };
  DeviceCertificate.write = function(obj, pbf) {
    if (obj.type) pbf.writeVarintField(1, obj.type);
    if (obj.serial_number) pbf.writeBytesField(2, obj.serial_number);
    if (obj.creation_time_seconds) pbf.writeVarintField(3, obj.creation_time_seconds);
    if (obj.public_key) pbf.writeBytesField(4, obj.public_key);
    if (obj.system_id) pbf.writeVarintField(5, obj.system_id);
    if (obj.test_device_deprecated) pbf.writeBooleanField(6, obj.test_device_deprecated);
    if (obj.service_id) pbf.writeStringField(7, obj.service_id);
  };
  DeviceCertificate.CertificateType = {
    "ROOT": {
      "value": 0,
      "options": {}
    },
    "INTERMEDIATE": {
      "value": 1,
      "options": {}
    },
    "USER_DEVICE": {
      "value": 2,
      "options": {}
    },
    "SERVICE": {
      "value": 3,
      "options": {}
    }
  };
  var SignedDeviceCertificate = self.SignedDeviceCertificate = {};
  SignedDeviceCertificate.read = function(pbf, end) {
    return pbf.readFields(SignedDeviceCertificate._readField, { device_certificate: null, signature: null, signer: null }, end);
  };
  SignedDeviceCertificate._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.device_certificate = pbf.readBytes();
    else if (tag === 2) obj.signature = pbf.readBytes();
    else if (tag === 3) obj.signer = SignedDeviceCertificate.read(pbf, pbf.readVarint() + pbf.pos);
  };
  SignedDeviceCertificate.write = function(obj, pbf) {
    if (obj.device_certificate) pbf.writeBytesField(1, obj.device_certificate);
    if (obj.signature) pbf.writeBytesField(2, obj.signature);
    if (obj.signer) pbf.writeMessage(3, SignedDeviceCertificate.write, obj.signer);
  };
  var ProvisionedDeviceInfo = self.ProvisionedDeviceInfo = {};
  ProvisionedDeviceInfo.read = function(pbf, end) {
    return pbf.readFields(ProvisionedDeviceInfo._readField, { system_id: 0, soc: "", manufacturer: "", model: "", device_type: "", model_year: 0, security_level: { "value": 0, "options": {} }, test_device: false }, end);
  };
  ProvisionedDeviceInfo._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.system_id = pbf.readVarint();
    else if (tag === 2) obj.soc = pbf.readString();
    else if (tag === 3) obj.manufacturer = pbf.readString();
    else if (tag === 4) obj.model = pbf.readString();
    else if (tag === 5) obj.device_type = pbf.readString();
    else if (tag === 6) obj.model_year = pbf.readVarint();
    else if (tag === 7) obj.security_level = pbf.readVarint();
    else if (tag === 8) obj.test_device = pbf.readBoolean();
  };
  ProvisionedDeviceInfo.write = function(obj, pbf) {
    if (obj.system_id) pbf.writeVarintField(1, obj.system_id);
    if (obj.soc) pbf.writeStringField(2, obj.soc);
    if (obj.manufacturer) pbf.writeStringField(3, obj.manufacturer);
    if (obj.model) pbf.writeStringField(4, obj.model);
    if (obj.device_type) pbf.writeStringField(5, obj.device_type);
    if (obj.model_year) pbf.writeVarintField(6, obj.model_year);
    if (obj.security_level != void 0 && obj.security_level !== { "value": 0, "options": {} }) pbf.writeVarintField(7, obj.security_level);
    if (obj.test_device) pbf.writeBooleanField(8, obj.test_device);
  };
  ProvisionedDeviceInfo.WvSecurityLevel = {
    "LEVEL_UNSPECIFIED": {
      "value": 0,
      "options": {}
    },
    "LEVEL_1": {
      "value": 1,
      "options": {}
    },
    "LEVEL_2": {
      "value": 2,
      "options": {}
    },
    "LEVEL_3": {
      "value": 3,
      "options": {}
    }
  };
  var DeviceCertificateStatus = self.DeviceCertificateStatus = {};
  DeviceCertificateStatus.read = function(pbf, end) {
    return pbf.readFields(DeviceCertificateStatus._readField, { serial_number: null, status: { "value": 0, "options": {} }, device_info: null }, end);
  };
  DeviceCertificateStatus._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.serial_number = pbf.readBytes();
    else if (tag === 2) obj.status = pbf.readVarint();
    else if (tag === 4) obj.device_info = ProvisionedDeviceInfo.read(pbf, pbf.readVarint() + pbf.pos);
  };
  DeviceCertificateStatus.write = function(obj, pbf) {
    if (obj.serial_number) pbf.writeBytesField(1, obj.serial_number);
    if (obj.status != void 0 && obj.status !== { "value": 0, "options": {} }) pbf.writeVarintField(2, obj.status);
    if (obj.device_info) pbf.writeMessage(4, ProvisionedDeviceInfo.write, obj.device_info);
  };
  DeviceCertificateStatus.CertificateStatus = {
    "VALID": {
      "value": 0,
      "options": {}
    },
    "REVOKED": {
      "value": 1,
      "options": {}
    }
  };
  var DeviceCertificateStatusList = self.DeviceCertificateStatusList = {};
  DeviceCertificateStatusList.read = function(pbf, end) {
    return pbf.readFields(DeviceCertificateStatusList._readField, { creation_time_seconds: 0, certificate_status: [] }, end);
  };
  DeviceCertificateStatusList._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.creation_time_seconds = pbf.readVarint();
    else if (tag === 2) obj.certificate_status.push(DeviceCertificateStatus.read(pbf, pbf.readVarint() + pbf.pos));
  };
  DeviceCertificateStatusList.write = function(obj, pbf) {
    if (obj.creation_time_seconds) pbf.writeVarintField(1, obj.creation_time_seconds);
    if (obj.certificate_status) for (var i = 0; i < obj.certificate_status.length; i++) pbf.writeMessage(2, DeviceCertificateStatus.write, obj.certificate_status[i]);
  };
  var SignedCertificateStatusList = self.SignedCertificateStatusList = {};
  SignedCertificateStatusList.read = function(pbf, end) {
    return pbf.readFields(SignedCertificateStatusList._readField, { certificate_status_list: null, signature: null }, end);
  };
  SignedCertificateStatusList._readField = function(tag, obj, pbf) {
    if (tag === 1) obj.certificate_status_list = pbf.readBytes();
    else if (tag === 2) obj.signature = pbf.readBytes();
  };
  SignedCertificateStatusList.write = function(obj, pbf) {
    if (obj.certificate_status_list) pbf.writeBytesField(1, obj.certificate_status_list);
    if (obj.signature) pbf.writeBytesField(2, obj.signature);
  };
  var license_protocol_proto_default = {
    License,
    SignedMessage
  };

  // src/content_key_decryption.ts
  var {
    License: License2,
    SignedMessage: SignedMessage2
  } = license_protocol_proto_default;
  var WidevineCrypto = {
    keysInitialized: false,
    chromeRSAPublicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtdHcRBiDWWxdJyKDLTPO9OTapumVnW+9g6k3RSflM0CESFEufZUJGC73UKe9e+u789HVZT04pB5or3WB0XOx
aOibJklLBkd7Yfn1OndVrenMKTE1F4/6jg5rmwyv4qFQ1u8M/ThZUrAgb8pTmKfb9vrv1V8AApwVzcQg3s48eESnKjBU99Vk8alPTjPSfOgoTDluGxQONWiwCaMwftNs
YrOzlde+V3UOb5FVzPcrOmaERfyujV3h4sHGRbTCsqYVwMalO7hmNmtemwt0xBuf5Juia7t1scuJypQ8lI1iEsB+JZVo3Uovfa9nNX0gl5TAq1tAh6M55/ttpWAirWHv
CQIDAQAB
-----END PUBLIC KEY-----`,
    chromeRSAPrivateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC10dxEGINZbF0nIoMtM8705Nqm6ZWdb72DqTdFJ+UzQIRIUS59lQkYLvdQp71767vz0dVlPTikHmiv
dYHRc7Fo6JsmSUsGR3th+fU6d1Wt6cwpMTUXj/qODmubDK/ioVDW7wz9OFlSsCBvylOYp9v2+u/VXwACnBXNxCDezjx4RKcqMFT31WTxqU9OM9J86ChMOW4bFA41aLAJ
ozB+02xis7OV175XdQ5vkVXM9ys6ZoRF/K6NXeHiwcZFtMKyphXAxqU7uGY2a16bC3TEG5/km6Jru3Wxy4nKlDyUjWISwH4llWjdSi99r2c1fSCXlMCrW0CHoznn+22l
YCKtYe8JAgMBAAECggEAGOPDJvFCHd43PFG9qlTyylR/2CSWzigLRfhGsClfd24oDaxLVHav+YcIZRqpVkr1flGlyEeittjQ1OAdptoTGbzp7EpRQmlLqyRoHRpT+MxO
Hf91+KVFk+fGdEG+3CPgKKQt34Y0uByTPCpy2i10b7F3Xnq0Sicq1vG33DhYT9A/DRIjYr8Y0AVovq0VDjWqA1FW5OO9p7vky6e+PDMjSHucQ+uaLzVZSc7vWOh0tH5M
0GVk17YpBiB/iTpw4zBUIcaneQX3eaIfSCDHK0SCD6IRF7kl+uORzvWqiWlGzpdG2B96uyP4hd3WoPcZntM79PKm4dAotdgmalbueFJfpwKBgQDUy0EyA9Fq0aPF4LID
HqDPduIm4hEAZf6sQLd8Fe6ywM4p9KOEVx7YPaFxQHFSgIiWXswildPJl8Cg5cM2EyMU1tdn5xaR4VIDk8e2JEDfhPtaWskpJp2rU2wHvAXOeAES7UFMrkhKVqqVOdbo
IhlLdcYp5KxiJ3mwINSSO94ShwKBgQDavJvF+c8AINfCaMocUX0knXz+xCwdP430GoPQCHa1rUj5bZ3qn3XMwSWa57J4x3pVhYmgJv4jpEK+LBULFezNLV5N4C7vH63a
Zo4OF7IUedFBS5B508yAq7RiPhN2VOC8LRdDh5oqnFufjafF82y9d+/czCrVIG43D+KO2j4F7wKBgDg/HZWF0tYEYeDNGuCeOO19xBt5B/tt+lo3pQhkl7qiIhyO8KXr
jVilOcZAvXOMTA5LMnQ13ExeE2m0MdxaRJyeiUOKnrmisFYHuvNXM9qhQPtKIgABmA2QOG728SX5LHd/RRJqwur7a42UQ00Krlr235F1Q2eSfaTjmKyqrHGDAoGAOTrd
2ueoZFUzfnciYlRj1L+r45B6JlDpmDOTx0tfm9sx26j1h1yfWqoyZ5w1kupGNLgSsSdimPqyR8WK3/KlmW1EXkXIoeH8/8aTZlaGzlqtCFN4ApgKyqOiN44cU3qTrkhx
7MY+7OUqB83tVpqBGfWWeYOltUud6qQqV8v8LFsCgYEAnOq+Ls83CaHIWCjpVfiWC+R7mqW+ql1OGtoaajtA4AzhXzX8HIXpYjupPBlXlQ1FFfPem6jwa1UTZf8CpIb8
pPULAN9ZRrxG8V+bvkZWVREPTZj7xPCwPaZHNKoAmi3Dbv7S5SEYDbBX/NyPCLE4sj/AgTPbUsUtaiw5TvrPsFE=
-----END PRIVATE KEY-----`,
    async initializeKeys() {
      this.publicKeyEncrypt = await crypto.subtle.importKey(
        "spki",
        PEM2Binary(this.chromeRSAPublicKey),
        { name: "RSA-OAEP", hash: { name: "SHA-1" } },
        true,
        ["encrypt"]
      );
      this.publicKeyVerify = await crypto.subtle.importKey(
        "spki",
        PEM2Binary(this.chromeRSAPublicKey),
        { name: "RSA-PSS", hash: { name: "SHA-1" } },
        true,
        ["verify"]
      );
      this.privateKeyDecrypt = await crypto.subtle.importKey(
        "pkcs8",
        PEM2Binary(this.chromeRSAPrivateKey),
        { name: "RSA-OAEP", hash: { name: "SHA-1" } },
        true,
        ["decrypt"]
      );
      if (!await isRSAConsistent(this.publicKeyEncrypt, this.privateKeyDecrypt)) {
        throw new Error("RSA key consistency check failed.");
      }
      this.keysInitialized = true;
    },
    async decryptContentKey(licenseRequest, licenseResponse) {
      licenseRequest = SignedMessage2.read(new Pbf(licenseRequest));
      licenseResponse = SignedMessage2.read(new Pbf(licenseResponse));
      if (licenseRequest.type !== SignedMessage2.MessageType.LICENSE_REQUEST.value) {
        return null;
      }
      const license = License2.read(new Pbf(licenseResponse.msg));
      if (!this.keysInitialized) {
        await this.initializeKeys();
      }
      const signatureVerified = await crypto.subtle.verify(
        { name: "RSA-PSS", saltLength: 20 },
        this.publicKeyVerify,
        licenseRequest.signature,
        licenseRequest.msg
      );
      if (!signatureVerified) {
        console.error("License request signature verification failed.");
        return null;
      }
      const sessionKey = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        this.privateKeyDecrypt,
        licenseResponse.session_key
      );
      const encoder = new TextEncoder();
      const contextEnc = concatBuffers([
        [1],
        encoder.encode("ENCRYPTION"),
        [0],
        licenseRequest.msg,
        intToBuffer(128)
      ]);
      const encryptKey = wordToByteArray(
        CryptoJS.CMAC(
          arrayToWordArray(new Uint8Array(sessionKey)),
          arrayToWordArray(new Uint8Array(contextEnc))
        ).words
      );
      const contentKeys = license.key.filter((key) => key.type === License2.KeyContainer.KeyType.CONTENT.value).map((currentKey) => {
        const keyData = currentKey.key.slice(0, 16);
        const keyIv = currentKey.iv.slice(0, 16);
        return wordToByteArray(
          CryptoJS.AES.decrypt(
            { ciphertext: arrayToWordArray(keyData) },
            arrayToWordArray(encryptKey),
            { iv: arrayToWordArray(keyIv) }
          ).words
        );
      });
      contentKeys.forEach((key, idx) => console.log(`Decrypted Key ${idx + 1}: ${toHexString(key)}`));
      return contentKeys[0];
    }
  };
  async function isRSAConsistent(publicKey, privateKey) {
    const testData = new Uint8Array([65, 66, 67, 68]);
    const encryptedData = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      testData
    );
    const decryptedData = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedData
    );
    return areBuffersEqual(testData, decryptedData);
  }
  function areBuffersEqual(buf1, buf2) {
    if (buf1.byteLength !== buf2.byteLength) return false;
    return new Uint8Array(buf1).every((val, idx) => val === new Uint8Array(buf2)[idx]);
  }
  function concatBuffers(arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    arrays.forEach((arr) => {
      merged.set(new Uint8Array(arr), offset);
      offset += arr.length;
    });
    return merged;
  }
  function wordToByteArray(wordArray) {
    return wordArray.flatMap((word) => [24, 16, 8, 0].map((shift) => word >> shift & 255));
  }
  function arrayToWordArray(u8Array) {
    const words = [];
    for (let i = 0; i < u8Array.length; i += 4) {
      words.push(
        u8Array[i] << 24 | u8Array[i + 1] << 16 | u8Array[i + 2] << 8 | u8Array[i + 3]
      );
    }
    return { words, sigBytes: u8Array.length };
  }
  var toHexString = (bytes) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
  var intToBuffer = (num) => {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, num);
    return Array.from(new Uint8Array(buffer));
  };
  function PEM2Binary(pem) {
    return Uint8Array.from(
      atob(pem.replace(/-----\w+ KEY-----|\n/g, "")),
      (char) => char.charCodeAt(0)
    ).buffer;
  }
  var content_key_decryption_default = WidevineCrypto;

  // src/eme_interception.ts
  var lastReceivedLicenseRequest = null;
  var lastReceivedLicenseResponse = null;
  var startEMEInterception = () => {
    const listener = new EmeInterception();
    listener.setUpListeners();
  };
  var EmeInterception = class _EmeInterception {
    constructor() {
      this.unprefixedEmeEnabled = !!Navigator.prototype.requestMediaKeySystemAccess;
      this.prefixedEmeEnabled = !!HTMLMediaElement.prototype.webkitGenerateKeyRequest;
    }
    static NUM_MEDIA_ELEMENT_TYPES = 3;
    static onOperation(operationType, args) {
      switch (operationType) {
        case "GenerateRequestCall":
          break;
        case "MessageEvent":
          lastReceivedLicenseRequest = args.message;
          break;
        case "UpdateCall":
          lastReceivedLicenseResponse = args[0];
          content_key_decryption_default.decryptContentKey(lastReceivedLicenseRequest, lastReceivedLicenseResponse);
          break;
      }
    }
    static extendEmeMethod(element, originalFn, type) {
      return function(...args) {
        try {
          const result = originalFn.apply(element, args);
          _EmeInterception.onOperation(type, args);
          return result;
        } catch (error) {
          console.error(`Error in ${type}:`, error);
        }
      };
    }
    static interceptCall(type, args, result, target) {
      _EmeInterception.onOperation(type, args);
      return args;
    }
    static interceptEvent(type, event) {
      _EmeInterception.onOperation(type, event);
      return event;
    }
    static addRobustnessLevelIfNeeded(options) {
      options.forEach((option) => {
        const { videoCapabilities = [], audioCapabilities = [] } = option;
        videoCapabilities.forEach((capability) => {
          if (!capability.robustness) capability.robustness = "SW_SECURE_CRYPTO";
        });
        audioCapabilities.forEach((capability) => {
          if (!capability.robustness) capability.robustness = "SW_SECURE_CRYPTO";
        });
        option.videoCapabilities = videoCapabilities;
        option.audioCapabilities = audioCapabilities;
      });
      return options;
    }
    setUpListeners() {
      if (!this.unprefixedEmeEnabled && !this.prefixedEmeEnabled) return;
      if (this.unprefixedEmeEnabled) this.addListenersToNavigator();
      if (this.prefixedEmeEnabled) {
      }
      this.addListenersToAllEmeElements();
    }
    addListenersToNavigator() {
      if (navigator.listenersAdded_) return;
      const originalRequestMediaKeySystemAccessFn = _EmeInterception.extendEmeMethod(
        navigator,
        navigator.requestMediaKeySystemAccess,
        "RequestMediaKeySystemAccessCall"
      );
      navigator.requestMediaKeySystemAccess = (...args) => {
        const [_, options] = args;
        args[1] = _EmeInterception.addRobustnessLevelIfNeeded(options);
        return originalRequestMediaKeySystemAccessFn.apply(navigator, args).then((mediaKeySystemAccess) => {
          this.addListenersToMediaKeySystemAccess(mediaKeySystemAccess);
          return mediaKeySystemAccess;
        });
      };
      navigator.listenersAdded_ = true;
    }
    addListenersToMediaKeySystemAccess(mediaKeySystemAccess) {
      if (mediaKeySystemAccess.listenersAdded_) return;
      const originalCreateMediaKeysFn = _EmeInterception.extendEmeMethod(
        mediaKeySystemAccess,
        mediaKeySystemAccess.createMediaKeys,
        "CreateMediaKeysCall"
      );
      mediaKeySystemAccess.createMediaKeys = (...args) => {
        return originalCreateMediaKeysFn.apply(mediaKeySystemAccess, args).then((mediaKeys) => {
          mediaKeys.keySystem_ = mediaKeySystemAccess.keySystem;
          this.addListenersToMediaKeys(mediaKeys);
          return mediaKeys;
        });
      };
      mediaKeySystemAccess.listenersAdded_ = true;
    }
    addListenersToMediaKeys(mediaKeys) {
      if (mediaKeys.listenersAdded_) return;
      mediaKeys.createSession = _EmeInterception.extendEmeMethod(
        mediaKeys,
        mediaKeys.createSession,
        "CreateSessionCall"
      );
      mediaKeys.setServerCertificate = _EmeInterception.extendEmeMethod(
        mediaKeys,
        mediaKeys.setServerCertificate,
        "SetServerCertificateCall"
      );
      mediaKeys.listenersAdded_ = true;
    }
    addListenersToAllEmeElements() {
      this.addEmeInterceptionToInitialMediaElements();
    }
    addEmeInterceptionToInitialMediaElements() {
      const elements = [
        ...document.getElementsByTagName("audio"),
        ...document.getElementsByTagName("video"),
        ...document.getElementsByTagName("media")
      ];
      elements.forEach((element) => this.addListenersToEmeElement(element));
    }
    addListenersToEmeElement(element) {
      if (!element.eventListenersAdded_) this.addEmeEventListeners(element);
      if (!element.methodListenersAdded_) this.addEmeMethodListeners(element);
      console.info("EME listeners successfully added to:", element);
    }
    addEmeEventListeners(element) {
      const addEventListener = (event, type) => element.addEventListener(event, _EmeInterception.interceptEvent.bind(null, type));
      if (this.prefixedEmeEnabled) {
        addEventListener("webkitneedkey", "NeedKeyEvent");
        addEventListener("webkitkeymessage", "KeyMessageEvent");
        addEventListener("webkitkeyadded", "KeyAddedEvent");
        addEventListener("webkitkeyerror", "KeyErrorEvent");
      }
      addEventListener("encrypted", "EncryptedEvent");
      addEventListener("play", "PlayEvent");
      addEventListener("error", (e) => console.error("Error Event:", e));
      element.eventListenersAdded_ = true;
    }
    addEmeMethodListeners(element) {
      element.play = _EmeInterception.extendEmeMethod(element, element.play, "PlayCall");
      if (this.prefixedEmeEnabled) {
        element.canPlayType = _EmeInterception.extendEmeMethod(element, element.canPlayType, "CanPlayTypeCall");
        element.webkitGenerateKeyRequest = _EmeInterception.extendEmeMethod(
          element,
          element.webkitGenerateKeyRequest,
          "GenerateKeyRequestCall"
        );
      }
      if (this.unprefixedEmeEnabled) {
        element.setMediaKeys = _EmeInterception.extendEmeMethod(element, element.setMediaKeys, "SetMediaKeysCall");
      }
      element.methodListenersAdded_ = true;
    }
  };
  startEMEInterception();

  // src/content_script.ts
  startEMEInterception();
})();
