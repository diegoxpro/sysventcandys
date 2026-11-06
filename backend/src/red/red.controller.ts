import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/decorators';
import { ipPrincipal, puertos } from './certificados';
import { urlEntrada, urlHttps } from './servidor-red';

@Controller('red')
export class RedController {
  /** La página del QR lo usa para saber si el celular ya confía en el certificado. */
  @Publico()
  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Get('info')
  info() {
    return { ip: ipPrincipal(), activo: !!puertos.https, https: urlHttps(), entrada: urlEntrada() };
  }
}
