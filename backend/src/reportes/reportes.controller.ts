import { BadRequestException, Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../auth/decorators';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { reporteAExcel } from './reporte';
import { NombreReporte, REPORTES, ReportesService } from './reportes.service';

@Roles(Rol.ADMIN)
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly config: ConfiguracionService,
  ) {}

  @Get()
  lista() {
    return Object.entries(REPORTES).map(([id, titulo]) => ({ id, titulo, usaFechas: id !== 'stock-valorizado' }));
  }

  @Get(':nombre')
  async generar(
    @Param('nombre') nombre: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('formato') formato: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!(nombre in REPORTES)) throw new BadRequestException('Reporte desconocido');
    const filtro = nombre === 'stock-valorizado' ? { desde: new Date(0), hasta: new Date(), etiqueta: '' } : this.reportes.filtro(desde, hasta);
    const reporte = await this.reportes.generar(nombre as NombreReporte, filtro);
    if (formato !== 'xlsx') return reporte;

    const cfg = await this.config.obtener();
    const archivo = `${nombre}${desde ? `_${desde}_${hasta}` : ''}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
    });
    return new StreamableFile(await reporteAExcel(reporte, cfg.empresaNombre));
  }
}
