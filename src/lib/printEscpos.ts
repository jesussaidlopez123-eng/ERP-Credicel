import { bytesToBase64 } from './escpos';
import { isAndroidPrintHost, isRestrictedPrintHost } from './printWindow';

const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';
const BLE_OPTIONAL_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000ff50-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455'
];

export type ThermalPrintChannel = 'ble' | 'rawbt' | 'image';

export function prefersEscPosText(
  ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints || 0
): boolean {
  return isAndroidPrintHost(ua) && isRestrictedPrintHost(ua, maxTouchPoints);
}

type BleCharacteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
};

type BleService = {
  getCharacteristics: () => Promise<BleCharacteristic[]>;
};

type BleServer = {
  getPrimaryServices: () => Promise<BleService[]>;
};

type BleDevice = {
  gatt?: {
    connected?: boolean;
    connect: () => Promise<BleServer>;
  };
};

type BleNavigator = Navigator & {
  bluetooth?: {
    getDevices?: () => Promise<BleDevice[]>;
    requestDevice: (options: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }) => Promise<BleDevice>;
  };
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function writeCharacteristic(char: BleCharacteristic, bytes: Uint8Array): Promise<void> {
  const chunk = 20;
  const canWithout = Boolean(char.properties.writeWithoutResponse && char.writeValueWithoutResponse);
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    const copy = slice.slice();
    if (canWithout && char.writeValueWithoutResponse) {
      await char.writeValueWithoutResponse(copy);
    } else if (char.writeValue) {
      await char.writeValue(copy);
    } else {
      throw new Error('La térmica Bluetooth no acepta escritura');
    }
    await delay(18);
  }
}

async function findWriteCharacteristic(server: BleServer): Promise<BleCharacteristic | null> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    const writable = chars.find(
      (c) => c.properties.writeWithoutResponse || c.properties.write
    );
    if (writable) return writable;
  }
  return null;
}

async function sendViaBluetooth(bytes: Uint8Array, requestIfNeeded: boolean): Promise<boolean> {
  const bluetooth = (navigator as BleNavigator).bluetooth;
  if (!bluetooth) return false;
  let device: BleDevice | undefined;
  try {
    const known = (await bluetooth.getDevices?.()) || [];
    device = known[0];
  } catch {
    device = undefined;
  }
  if (!device && requestIfNeeded) {
    try {
      device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_OPTIONAL_SERVICES
      });
    } catch {
      return false;
    }
  }
  if (!device?.gatt) return false;
  try {
    const server = device.gatt.connected ? await device.gatt.connect() : await device.gatt.connect();
    const char = await findWriteCharacteristic(server);
    if (!char) return false;
    await writeCharacteristic(char, bytes);
    return true;
  } catch (err) {
    console.error('No se pudo enviar ESC/POS por Bluetooth:', err);
    return false;
  }
}

export function buildRawBtIntentUrl(bytes: Uint8Array): string {
  const payload = `base64,${bytesToBase64(bytes)}`;
  return `intent:${encodeURIComponent(payload)}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end`;
}

export function openRawBtEscPos(bytes: Uint8Array): boolean {
  if (typeof document === 'undefined') return false;
  const url = buildRawBtIntentUrl(bytes);
  if (url.length > 70000) return false;
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export async function printEscPosBytes(
  bytes: Uint8Array,
  imageFallback?: () => void,
  options?: { requestDevice?: boolean }
): Promise<ThermalPrintChannel> {
  if (typeof window === 'undefined') return 'image';

  if (prefersEscPosText()) {
    const ble = await sendViaBluetooth(bytes, options?.requestDevice === true);
    if (ble) return 'ble';
    if (openRawBtEscPos(bytes)) return 'rawbt';
  }

  imageFallback?.();
  return 'image';
}
