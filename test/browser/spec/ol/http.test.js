import {
  createImageLoadFunction,
  createTileLoadFunction,
} from '../../../../src/ol/http.js';

/**
 * Polls until the given condition is truthy.
 * @param {function():*} condition The condition to wait for.
 * @return {Promise} Resolves once the condition is truthy.
 */
function waitFor(condition) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > 2000) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

describe('ol/http', function () {
  const SRC = 'https://example.com/image.png';
  let fetchStub;

  afterEach(function () {
    if (fetchStub) {
      fetchStub.mockRestore();
      fetchStub = null;
    }
  });

  describe('createImageLoadFunction', function () {
    it('assigns the source directly when no headers are returned', function () {
      fetchStub = vi.spyOn(window, 'fetch');
      const load = createImageLoadFunction(() => null);
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      expect(img.src).to.equal(SRC);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('assigns the source directly when the headers are empty', function () {
      fetchStub = vi.spyOn(window, 'fetch');
      const load = createImageLoadFunction(() => ({}));
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      expect(img.src).to.equal(SRC);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('fetches with headers and assigns an object URL', async function () {
      const blob = new Blob(['data'], {type: 'image/png'});
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response(blob, {status: 200}));
      const load = createImageLoadFunction(() => ({
        Authorization: 'Bearer 123',
      }));
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      await waitFor(() => img.src.startsWith('blob:'));
      expect(fetchStub).toHaveBeenCalledOnce();
      const [url, init] = fetchStub.mock.calls[0];
      expect(url).to.equal(SRC);
      expect(init.headers.Authorization).to.equal('Bearer 123');
    });

    it('revokes the object URL once the image loaded', async function () {
      const blob = new Blob(['data'], {type: 'image/png'});
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response(blob, {status: 200}));
      const revokeStub = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {});
      try {
        const load = createImageLoadFunction(() => ({
          Authorization: 'Bearer 123',
        }));
        const img = document.createElement('img');
        load({getImage: () => img}, SRC);
        await waitFor(() => img.src.startsWith('blob:'));
        const objectUrl = img.src;
        img.dispatchEvent(new Event('load'));
        expect(revokeStub).toHaveBeenCalledWith(objectUrl);
      } finally {
        revokeStub.mockRestore();
      }
    });

    it('falls back to the source and reports on request failure', async function () {
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response('', {status: 401}));
      const onError = vi.fn();
      const load = createImageLoadFunction(
        () => ({Authorization: 'Bearer 123'}),
        onError,
      );
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      await waitFor(() => img.src === SRC);
      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0][0]).to.be.an.instanceOf(Error);
    });
  });

  describe('createTileLoadFunction', function () {
    it('assigns the source directly when no headers are returned', function () {
      fetchStub = vi.spyOn(window, 'fetch');
      const load = createTileLoadFunction(() => null);
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      expect(img.src).to.equal(SRC);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('asks for headers per tile URL', async function () {
      const blob = new Blob(['data'], {type: 'image/png'});
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response(blob, {status: 200}));
      const getHeaders = vi.fn((url) =>
        url.includes('example.com') ? {Authorization: 'Bearer 123'} : null,
      );
      const load = createTileLoadFunction(getHeaders);

      const authorized = document.createElement('img');
      load({getImage: () => authorized}, SRC);
      await waitFor(() => authorized.src.startsWith('blob:'));

      const external = document.createElement('img');
      const externalSrc = 'https://other.host/tile.png';
      load({getImage: () => external}, externalSrc);
      expect(external.src).to.equal(externalSrc);

      expect(getHeaders).toHaveBeenCalledTimes(2);
      expect(fetchStub).toHaveBeenCalledOnce();
    });
  });
});
