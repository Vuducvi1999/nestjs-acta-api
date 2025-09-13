import { SetMetadata } from '@nestjs/common';

export const IS_EXTERNAL_APP_KEY = 'isExternalApp';

export const ExternalApp = () => {
  return SetMetadata(IS_EXTERNAL_APP_KEY, true);
};