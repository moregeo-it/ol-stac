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
      fetchStub.restore();
      fetchStub = null;
    }
  });

  describe('createImageLoadFunction', function () {
    it('assigns the source directly when no headers are returned', function () {
      fetchStub = sinon.stub(window, 'fetch');
      const load = createImageLoadFunction(() => null);
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      expect(img.src).to.be(SRC);
      expect(fetchStub.called).to.be(false);
    });

    it('assigns the source directly when the headers are empty', function () {
      fetchStub = sinon.stub(window, 'fetch');
      const load = createImageLoadFunction(() => ({}));
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      expect(img.src).to.be(SRC);
      expect(fetchStub.called).to.be(false);
    });

    it('fetches with headers and assigns an object URL', async function () {
      const blob = new Blob(['data'], {type: 'image/png'});
      fetchStub = sinon
        .stub(window, 'fetch')
        .resolves(new Response(blob, {status: 200}));
      const load = createImageLoadFunction(() => ({
        Authorization: 'Bearer 123',
      }));
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      await waitFor(() => img.src.startsWith('blob:'));
      expect(fetchStub.calledOnce).to.be(true);
      const [url, init] = fetchStub.firstCall.args;
      expect(url).to.be(SRC);
      expect(init.headers.Authorization).to.be('Bearer 123');
    });

    it('revokes the object URL once the image loaded', async function () {
      const blob = new Blob(['data'], {type: 'image/png'});
      fetchStub = sinon
        .stub(window, 'fetch')
        .resolves(new Response(blob, {status: 200}));
      const revokeStub = sinon.stub(URL, 'revokeObjectURL');
      try {
        const load = createImageLoadFunction(() => ({
          Authorization: 'Bearer 123',
        }));
        const img = document.createElement('img');
        load({getImage: () => img}, SRC);
        await waitFor(() => img.src.startsWith('blob:'));
        const objectUrl = img.src;
        img.dispatchEvent(new Event('load'));
        expect(revokeStub.calledWith(objectUrl)).to.be(true);
      } finally {
        revokeStub.restore();
      }
    });

    it('falls back to the source and reports on request failure', async function () {
      fetchStub = sinon
        .stub(window, 'fetch')
        .resolves(new Response('', {status: 401}));
      const onError = sinon.spy();
      const load = createImageLoadFunction(
        () => ({Authorization: 'Bearer 123'}),
        onError,
      );
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      await waitFor(() => img.src === SRC);
      expect(onError.calledOnce).to.be(true);
      expect(onError.firstCall.args[0]).to.be.an(Error);
    });
  });

  describe('createTileLoadFunction', function () {
    it('assigns the source directly when no headers are returned', function () {
      fetchStub = sinon.stub(window, 'fetch');
      const load = createTileLoadFunction(() => null);
      const img = document.createElement('img');
      load({getImage: () => img}, SRC);
      expect(img.src).to.be(SRC);
      expect(fetchStub.called).to.be(false);
    });

    it('asks for headers per tile URL', async function () {
      const blob = new Blob(['data'], {type: 'image/png'});
      fetchStub = sinon
        .stub(window, 'fetch')
        .resolves(new Response(blob, {status: 200}));
      const getHeaders = sinon.spy((url) =>
        url.includes('example.com') ? {Authorization: 'Bearer 123'} : null,
      );
      const load = createTileLoadFunction(getHeaders);

      const authorized = document.createElement('img');
      load({getImage: () => authorized}, SRC);
      await waitFor(() => authorized.src.startsWith('blob:'));

      const external = document.createElement('img');
      const externalSrc = 'https://other.host/tile.png';
      load({getImage: () => external}, externalSrc);
      expect(external.src).to.be(externalSrc);

      expect(getHeaders.calledTwice).to.be(true);
      expect(fetchStub.calledOnce).to.be(true);
    });
  });
});
