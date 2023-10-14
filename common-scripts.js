/* Settings flags */
const settingsFlagsKey = '?';
const settingsFlagsEnum = {
  allowCategoryEditing: 1,
  isRandomized: 2,
  allowCardEditing: 4,
  allowCardDup: 8,
};
const settingsDefaults = {
  allowCardEditing: false,
  allowCardDup: false,
  allowCategoryEditing: true,
  isRandomized: false,
};

function loadSettings(data) {
  const settings = Object.assign({}, settingsDefaults);
  const flags = data[settingsFlagsKey];
  for (const settingName of Object.keys(settingsFlagsEnum)) {
    settings[settingName] = Boolean(settingsFlagsEnum[settingName] & flags);
  }
  return settings;
}
function saveSettings(settings) {
  let flags = 0;
  for (const [settingName, isEnabled] of Object.entries(settings)) {
    if (isEnabled) {
      flags |= settingsFlagsEnum[settingName];
    }
  }
  return flags;
}

/* Saving and loading */
const uncategorizedKey = '#';
const reservedKeys = [
  settingsFlagsKey,
  uncategorizedKey,
];
const regexRemoveBasenameFromUrl = /\/[^\/]*?$/;

async function uint8ArrayToBase64(data) {
  const base64url = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(new Blob([data]));
  });
  return base64url.split(',', 2)[1];
}
async function base64ToUint8Array(base64string) {
  const response = await fetch('data:;base64,' + base64string);
  const blob = await response.blob();
  return new Uint8Array(await blob.arrayBuffer());
}
async function saveToString(data) {
  const jsonString = JSON.stringify(data);
  const compressedData = pako.deflate(new TextEncoder().encode(jsonString));
  const base64String = await uint8ArrayToBase64(compressedData);
  const webSafeBase64String = base64String.replaceAll('+', '-').replaceAll('/', '_');
  return webSafeBase64String;
}
async function loadFromString(webSafeBase64String) {
  const base64String = webSafeBase64String.replaceAll('-', '+').replaceAll('_', '/');
  const compressedData = await base64ToUint8Array(base64String);
  const jsonString = new TextDecoder('utf8').decode(pako.inflate(compressedData));
  const data = JSON.parse(jsonString);
  return data;
}
function loadFromQueryParameters() {
  const data = {};
  const settings = Object.assign({}, settingsDefaults);
  const params = new URLSearchParams(window.location.search);
  const cardTexts = (params.get('cards') || '').split(',').filter(item => !!item);
  const categories = (params.get('categories') || '').split(',').filter(item => !!item);
  if (params.get('allowCategoryEditing') !== null) {
    settings.allowCategoryEditing = Boolean(parseInt(params.get('allowCategoryEditing')));
  }
  if (params.get('isRandomized') !== null) {
    settings.isRandomized = Boolean(parseInt(params.get('isRandomized')));
  }
  if (params.get('allowCardEditing') !== null) {
    settings.allowCardEditing = Boolean(parseInt(params.get('allowCardEditing')));
  }
  if (params.get('allowCardDup') !== null) {
    settings.allowCardDup = Boolean(parseInt(params.get('allowCardDup')));
  }
  data[uncategorizedKey] = cardTexts;
  data[settingsFlagsKey] = saveSettings(settings);
  for (const categoryName of categories) {
    data[categoryName] = [];
  }
  return data;
}

/* Utilities */
function debounce(func, wait, immediate) {
  let timeout;
  return function debouncedFunc() {
    const context = this;
    const args = arguments;
    const later = function () {
      timeout = null;
      if ( ! immediate) {
        func.apply(context, args);
      }
    };
    const callNow = immediate && ! timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

function asTextContent(input) {
  const tempElement = document.createElement('span');
  tempElement.textContent = input;
  return tempElement.innerHTML;
}

function setContentEditablePlaintext(element) {
  element.setAttribute('contenteditable', 'PLAINTEXT-ONLY');
  const isPlaintextSupported = element.contentEditable === 'plaintext-only';
  element.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      element.blur();
      event.preventDefault();
    }
  });
  element.addEventListener('blur', function(event) {
    // Combine text nodes into one text node
    element.textContent = element.textContent;
  });
  if (isPlaintextSupported) {
    return;
  }
  // Polyfill for contenteditable="plaintext-only"
  element.contentEditable = true;
  const observer = new MutationObserver(plaintextOnlyMutationHandler);
  observer.observe(element, {childList: true, subtree: true});
}

function plaintextOnlyMutationHandler(mutationList, observer) {
  for (const mutation of mutationList) {
    for (const addedNode of mutation.addedNodes) {
      if (addedNode.nodeType == Node.ELEMENT_NODE) {
        addedNode.replaceWith(addedNode.textContent);
      }
    }
  }
}