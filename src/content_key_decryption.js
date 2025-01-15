/**
 * Modernized WidevineCrypto Implementation
 */

const WidevineCrypto = {
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
            'spki',
            PEM2Binary(this.chromeRSAPublicKey),
            { name: 'RSA-OAEP', hash: { name: 'SHA-1' } },
            true,
            ['encrypt']
        );

        this.publicKeyVerify = await crypto.subtle.importKey(
            'spki',
            PEM2Binary(this.chromeRSAPublicKey),
            { name: 'RSA-PSS', hash: { name: 'SHA-1' } },
            true,
            ['verify']
        );

        this.privateKeyDecrypt = await crypto.subtle.importKey(
            'pkcs8',
            PEM2Binary(this.chromeRSAPrivateKey),
            { name: 'RSA-OAEP', hash: { name: 'SHA-1' } },
            true,
            ['decrypt']
        );

        if (!(await isRSAConsistent(this.publicKeyEncrypt, this.privateKeyDecrypt))) {
            throw new Error("RSA key consistency check failed.");
        }

        this.keysInitialized = true;
    },

    async decryptContentKey(licenseRequest, licenseResponse) {
        licenseRequest = SignedMessage.read(new Pbf(licenseRequest));
        licenseResponse = SignedMessage.read(new Pbf(licenseResponse));

        if (licenseRequest.type !== SignedMessage.MessageType.LICENSE_REQUEST.value) {
            return null;
        }

        const license = License.read(new Pbf(licenseResponse.msg));

        if (!this.keysInitialized) {
            await this.initializeKeys();
        }

        const signatureVerified = await crypto.subtle.verify(
            { name: 'RSA-PSS', saltLength: 20 },
            this.publicKeyVerify,
            licenseRequest.signature,
            licenseRequest.msg
        );

        if (!signatureVerified) {
            console.error("License request signature verification failed.");
            return null;
        }

        const sessionKey = await crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            this.privateKeyDecrypt,
            licenseResponse.session_key
        );

        const encoder = new TextEncoder();
        const contextEnc = concatBuffers([
            [0x01],
            encoder.encode("ENCRYPTION"),
            [0x00],
            licenseRequest.msg,
            intToBuffer(128)
        ]);

        const encryptKey = wordToByteArray(
            CryptoJS.CMAC(
                arrayToWordArray(new Uint8Array(sessionKey)),
                arrayToWordArray(new Uint8Array(contextEnc))
            ).words
        );

        const contentKeys = license.key
            .filter((key) => key.type === License.KeyContainer.KeyType.CONTENT.value)
            .map((currentKey) => {
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

/** Utility Functions */

async function isRSAConsistent(publicKey, privateKey) {
    const testData = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        testData
    );
    const decryptedData = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
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
    return wordArray.flatMap((word) => [24, 16, 8, 0].map((shift) => (word >> shift) & 0xff));
}

function arrayToWordArray(u8Array) {
    const words = [];
    for (let i = 0; i < u8Array.length; i += 4) {
        words.push(
            (u8Array[i] << 24) |
            (u8Array[i + 1] << 16) |
            (u8Array[i + 2] << 8) |
            u8Array[i + 3]
        );
    }
    return { words, sigBytes: u8Array.length };
}

const toHexString = (bytes) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const intToBuffer = (num) => {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, num);
    return Array.from(new Uint8Array(buffer));
};

function PEM2Binary(pem) {
    return Uint8Array.from(
        atob(pem.replace(/-----\w+ KEY-----|\n/g, '')),
        (char) => char.charCodeAt(0)
    ).buffer;
}
