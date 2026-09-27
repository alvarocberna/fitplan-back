import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3FileStorage } from './s3-file-storage';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

// Se espía S3Client.prototype.send para capturar los comandos sin tocar la red.
const sendSpy = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendSpy })),
  };
});

describe('S3FileStorage', () => {
  let service: S3FileStorage;
  const getSignedUrlMock = getSignedUrl as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      getOrThrow: jest.fn((key: string) => `valor-${key}`),
    } as unknown as ConfigService;
    service = new S3FileStorage(config);
    getSignedUrlMock.mockResolvedValue('https://signed.example/objeto');
  });

  describe('uploadImage', () => {
    it('sube el buffer con ContentType image/webp por defecto', async () => {
      const buffer = Buffer.from('webp');
      await service.uploadImage(buffer, 'productos-personalizados/miniaturas/order-1.webp');

      const command = sendSpy.mock.calls[0][0] as PutObjectCommand;
      expect(command.input).toMatchObject({
        Key: 'productos-personalizados/miniaturas/order-1.webp',
        Body: buffer,
        ContentType: 'image/webp',
      });
    });
  });

  describe('getSignedDownloadUrl', () => {
    const signedCommand = () => getSignedUrlMock.mock.calls[0][1] as GetObjectCommand;

    it('sin downloadFilename no fuerza descarga (el objeto se sirve inline)', async () => {
      const url = await service.getSignedDownloadUrl('productos-personalizados/order-1.pdf');

      expect(url).toBe('https://signed.example/objeto');
      expect(signedCommand().input.ResponseContentDisposition).toBeUndefined();
      expect(getSignedUrlMock.mock.calls[0][2]).toEqual({ expiresIn: 600 });
    });

    it('con downloadFilename firma Content-Disposition: attachment con ese nombre', async () => {
      await service.getSignedDownloadUrl('productos-personalizados/order-1.pdf', 300, {
        downloadFilename: 'plan-nutricional-2026-01-01.pdf',
      });

      expect(signedCommand().input).toMatchObject({
        Key: 'productos-personalizados/order-1.pdf',
        ResponseContentDisposition: 'attachment; filename="plan-nutricional-2026-01-01.pdf"',
      });
      expect(getSignedUrlMock.mock.calls[0][2]).toEqual({ expiresIn: 300 });
    });
  });
});
