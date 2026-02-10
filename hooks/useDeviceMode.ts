import { useEffect, useMemo, useState } from 'react';

type DeviceMode = 'phone' | 'desktop';

const getQueryOverride = (): DeviceMode | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('forceMobile') === '1') return 'phone';
  if (params.get('forceDesktop') === '1') return 'desktop';
  return null;
};

const detectPhoneOnly = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const override = getQueryOverride();
  if (override) return override === 'phone';

  const ua = navigator.userAgent || '';
  const isIpad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

  const isPhoneUA = /Android|iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|webOS/i.test(ua) && !isIpad;
  const isCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const isNarrow = window.innerWidth <= 768;

  return isPhoneUA && (isNarrow || isCoarse);
};

export const useDeviceMode = () => {
  const [isPhoneOnly, setIsPhoneOnly] = useState<boolean>(() => detectPhoneOnly());

  useEffect(() => {
    const update = () => setIsPhoneOnly(detectPhoneOnly());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const mode: DeviceMode = useMemo(() => (isPhoneOnly ? 'phone' : 'desktop'), [isPhoneOnly]);

  return { isPhoneOnly, mode };
};

