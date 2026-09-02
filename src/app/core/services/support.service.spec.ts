import { SupportService } from './support.service';

describe('SupportService Aquiles images', () => {
  const createService = () => new SupportService({} as any, {} as any);

  it('rejects files that are not JPEG, PNG or WebP images', async () => {
    const service = createService();
    const file = new File(['not-an-image'], 'document.pdf', {
      type: 'application/pdf',
    });

    await expectAsync(service.prepareAquilesImage(file))
      .toBeRejectedWithError('Usa una foto JPG, PNG o WebP.');
  });

  it('rejects source images larger than 12 MB before decoding them', async () => {
    const service = createService();
    const file = {
      name: 'huge-photo.jpg',
      type: 'image/jpeg',
      size: 12_000_001,
    } as File;

    await expectAsync(service.prepareAquilesImage(file))
      .toBeRejectedWithError('La foto debe pesar 12 MB o menos.');
  });
});
