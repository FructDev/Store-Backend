import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller'; // <-- Importado?

@Module({
  controllers: [LocationsController], // <-- AQUÍ?
  providers: [LocationsService],
})
export class LocationsModule {}
