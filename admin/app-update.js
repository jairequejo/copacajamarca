// Never clears session storage, cookies or unrelated application caches.
export async function checkAppUpdate(serviceWorker, pageURL) {
  if (!serviceWorker) return { kind: 'web' };
  const registration = await serviceWorker.getRegistration(pageURL);
  if (!registration) return { kind: 'web' };
  await withDeadline(registration.update(), 15000);
  if (registration.installing) await waitForWorker(registration.installing);
  return { kind: registration.waiting ? 'ready' : 'current', registration };
}

export async function registerAdminPWA(serviceWorker, moduleURL) {
  if (!serviceWorker) return null;
  const registration = await withDeadline(serviceWorker.register(new URL('./sw.js', moduleURL).href, {
    scope: new URL('./', moduleURL).href,
    updateViaCache: 'none',
  }), 15000);
  await withDeadline(serviceWorker.ready, 15000);
  return registration;
}

async function withDeadline(promise, timeout) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('La comprobación tardó demasiado. Revisa tu conexión y reintenta.')), timeout);
    })]);
  } finally { clearTimeout(timer); }
}

function waitForWorker(worker, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', changed);
      error ? reject(error) : resolve();
    };
    const changed = () => {
      if (['installed', 'activated'].includes(worker.state)) finish();
      if (worker.state === 'redundant') finish(new Error('No se pudo instalar la actualización. Reintenta.'));
    };
    const timer = setTimeout(() => finish(new Error('La actualización sigue descargándose. Reintenta en un momento.')), timeout);
    worker.addEventListener('statechange', changed);
    changed();
  });
}

export function activateAppUpdate(serviceWorker, registration, timeout = 12000) {
  const worker = registration.waiting;
  if (!worker) return Promise.reject(new Error('La actualización ya no está pendiente. Búscala de nuevo.'));
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      serviceWorker.removeEventListener('controllerchange', changed);
      worker.removeEventListener('statechange', changed);
      error ? reject(error) : resolve();
    };
    const changed = () => {
      if (serviceWorker.controller === worker || worker.state === 'activated') finish();
    };
    const timer = setTimeout(() => finish(new Error('Cierra las otras ventanas de Copa Cajamarca y vuelve a abrir la aplicación para completar la actualización.')), timeout);
    serviceWorker.addEventListener('controllerchange', changed);
    worker.addEventListener('statechange', changed);
    // Supported by workers using the conventional SKIP_WAITING message handler.
    // An unknown worker is never reported as activated unless it actually activates.
    try { worker.postMessage({ type: 'SKIP_WAITING' }); }
    catch (error) { finish(error); }
    changed();
  });
}

export function freshPageURL(pageURL, stamp = Date.now()) {
  const url = new URL(pageURL);
  url.searchParams.set('actualizacion', String(stamp));
  return url.href;
}

export function initAppSettings() {
  const button = document.getElementById('app-check-update');
  const reload = document.getElementById('app-reload');
  const status = document.getElementById('app-update-status');
  let result;
  const serviceWorker = navigator.serviceWorker;
  let registrationError;
  const registrationReady = registerAdminPWA(serviceWorker, import.meta.url).catch(error => {
    registrationError = error;
    return null;
  });
  const refreshPage = async () => {
    if (!navigator.onLine) throw new Error('Necesitas conexión para cargar la versión más reciente.');
    const url = freshPageURL(location.href);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    } catch {
      throw new Error('No se pudo recargar la aplicación. Revisa tu conexión y reintenta.');
    } finally { clearTimeout(timer); }
    if (!response.ok) throw new Error('No se pudo cargar la página. Reintenta en un momento.');
    location.replace(url);
  };
  const run = async (action) => {
    if (button.disabled) return;
    button.disabled = reload.disabled = true;
    status.textContent = 'Buscando la versión más reciente…';
    try { await action(); }
    catch (error) {
      result = undefined;
      button.textContent = 'Buscar actualización';
      status.textContent = error.message || 'No se pudo comprobar la actualización. Reintenta.';
    }
    finally { button.disabled = reload.disabled = false; }
  };
  button.addEventListener('click', () => run(async () => {
    if (result?.kind === 'ready') {
      status.textContent = 'Instalando actualización…';
      await activateAppUpdate(serviceWorker, result.registration);
      await refreshPage();
      return;
    }
    if (!navigator.onLine) throw new Error('Necesitas conexión para buscar actualizaciones.');
    await registrationReady;
    if (registrationError) throw new Error('No se pudo registrar el PWA. Revisa tu conexión y usa Recargar aplicación para reintentar.');
    result = await checkAppUpdate(serviceWorker, location.href);
    if (result.kind === 'ready') {
      status.textContent = 'Hay una actualización disponible. Guarda tus cambios y pulsa Instalar actualización.';
      button.textContent = 'Instalar actualización';
    } else if (result.kind === 'current') {
      status.textContent = 'No hay una actualización del PWA pendiente. Puedes recargar la página para renovar su contenido.';
    } else {
      status.textContent = 'Esta versión funciona como web, sin un PWA registrado. Usa Recargar aplicación para cargar la página más reciente.';
    }
  }));
  reload.addEventListener('click', () => run(refreshPage));
}
