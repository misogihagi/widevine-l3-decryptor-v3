import WidevineCrypto from './content_key_decryption'

/**
 * Hooks EME calls and forwards them for analysis and decryption.
 * Most of the code here was adapted from https://github.com/google/eme_logger/blob/master/eme_listeners.js
 */

let lastReceivedLicenseRequest = null;
let lastReceivedLicenseResponse = null;

/** Set up the EME listeners. */
export const startEMEInterception = () => {
  const listener = new EmeInterception();
  listener.setUpListeners();
};

/**
 * Handles EME operations and events.
 */
class EmeInterception {
  constructor() {
    this.unprefixedEmeEnabled = !!Navigator.prototype.requestMediaKeySystemAccess;
    this.prefixedEmeEnabled = !!HTMLMediaElement.prototype.webkitGenerateKeyRequest;
  }

  static NUM_MEDIA_ELEMENT_TYPES = 3;

  static onOperation(operationType, args) {
    switch (operationType) {
      case 'GenerateRequestCall':
        // Handle initData if needed
        break;
      case 'MessageEvent':
        lastReceivedLicenseRequest = args.message;
        break;
      case 'UpdateCall':
        lastReceivedLicenseResponse = args[0];
        WidevineCrypto.decryptContentKey(lastReceivedLicenseRequest, lastReceivedLicenseResponse);
        break;
    }
  }

  static extendEmeMethod(element, originalFn, type) {
    return function (...args) {
      try {
        const result = originalFn.apply(element, args);
        EmeInterception.onOperation(type, args);
        return result;
      } catch (error) {
        console.error(`Error in ${type}:`, error);
      }
    };
  }

  static interceptCall(type, args, result, target) {
    EmeInterception.onOperation(type, args);
    return args;
  }

  static interceptEvent(type, event) {
    EmeInterception.onOperation(type, event);
    return event;
  }

  static addRobustnessLevelIfNeeded(options) {
    options.forEach((option) => {
      const { videoCapabilities = [], audioCapabilities = [] } = option;

      videoCapabilities.forEach((capability) => {
        if (!capability.robustness) capability.robustness = 'SW_SECURE_CRYPTO';
      });

      audioCapabilities.forEach((capability) => {
        if (!capability.robustness) capability.robustness = 'SW_SECURE_CRYPTO';
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
      // Add prefixed EME listener setup logic here if needed
    }

    this.addListenersToAllEmeElements();
  }

  addListenersToNavigator() {
    if (navigator.listenersAdded_) return;

    const originalRequestMediaKeySystemAccessFn = EmeInterception.extendEmeMethod(
      navigator,
      navigator.requestMediaKeySystemAccess,
      'RequestMediaKeySystemAccessCall'
    );

    navigator.requestMediaKeySystemAccess = (...args) => {
      const [_, options] = args;
      args[1] = EmeInterception.addRobustnessLevelIfNeeded(options);
      return originalRequestMediaKeySystemAccessFn
        .apply(navigator, args)
        .then((mediaKeySystemAccess) => {
          this.addListenersToMediaKeySystemAccess(mediaKeySystemAccess);
          return mediaKeySystemAccess;
        });
    };

    navigator.listenersAdded_ = true;
  }

  addListenersToMediaKeySystemAccess(mediaKeySystemAccess) {
    if (mediaKeySystemAccess.listenersAdded_) return;

    const originalCreateMediaKeysFn = EmeInterception.extendEmeMethod(
      mediaKeySystemAccess,
      mediaKeySystemAccess.createMediaKeys,
      'CreateMediaKeysCall'
    );

    mediaKeySystemAccess.createMediaKeys = (...args) => {
      return originalCreateMediaKeysFn
        .apply(mediaKeySystemAccess, args)
        .then((mediaKeys) => {
          mediaKeys.keySystem_ = mediaKeySystemAccess.keySystem;
          this.addListenersToMediaKeys(mediaKeys);
          return mediaKeys;
        });
    };

    mediaKeySystemAccess.listenersAdded_ = true;
  }

  addListenersToMediaKeys(mediaKeys) {
    if (mediaKeys.listenersAdded_) return;

    mediaKeys.createSession = EmeInterception.extendEmeMethod(
      mediaKeys,
      mediaKeys.createSession,
      'CreateSessionCall'
    );

    mediaKeys.setServerCertificate = EmeInterception.extendEmeMethod(
      mediaKeys,
      mediaKeys.setServerCertificate,
      'SetServerCertificateCall'
    );

    mediaKeys.listenersAdded_ = true;
  }

  addListenersToAllEmeElements() {
    this.addEmeInterceptionToInitialMediaElements();
    // Future elements can be observed using MutationObserver if needed
  }

  addEmeInterceptionToInitialMediaElements() {
    const elements = [
      ...document.getElementsByTagName('audio'),
      ...document.getElementsByTagName('video'),
      ...document.getElementsByTagName('media'),
    ];
    elements.forEach((element) => this.addListenersToEmeElement(element));
  }

  addListenersToEmeElement(element) {
    if (!element.eventListenersAdded_) this.addEmeEventListeners(element);
    if (!element.methodListenersAdded_) this.addEmeMethodListeners(element);
    console.info('EME listeners successfully added to:', element);
  }

  addEmeEventListeners(element) {
    const addEventListener = (event, type) =>
      element.addEventListener(event, EmeInterception.interceptEvent.bind(null, type));

    if (this.prefixedEmeEnabled) {
      addEventListener('webkitneedkey', 'NeedKeyEvent');
      addEventListener('webkitkeymessage', 'KeyMessageEvent');
      addEventListener('webkitkeyadded', 'KeyAddedEvent');
      addEventListener('webkitkeyerror', 'KeyErrorEvent');
    }

    addEventListener('encrypted', 'EncryptedEvent');
    addEventListener('play', 'PlayEvent');
    addEventListener('error', (e) => console.error('Error Event:', e));
    element.eventListenersAdded_ = true;
  }

  addEmeMethodListeners(element) {
    element.play = EmeInterception.extendEmeMethod(element, element.play, 'PlayCall');
    if (this.prefixedEmeEnabled) {
      element.canPlayType = EmeInterception.extendEmeMethod(element, element.canPlayType, 'CanPlayTypeCall');
      element.webkitGenerateKeyRequest = EmeInterception.extendEmeMethod(
        element,
        element.webkitGenerateKeyRequest,
        'GenerateKeyRequestCall'
      );
    }
    if (this.unprefixedEmeEnabled) {
      element.setMediaKeys = EmeInterception.extendEmeMethod(element, element.setMediaKeys, 'SetMediaKeysCall');
    }
    element.methodListenersAdded_ = true;
  }
}

startEMEInterception();
