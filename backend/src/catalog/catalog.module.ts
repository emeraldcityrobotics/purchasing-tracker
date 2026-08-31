import {Module} from '@nestjs/common';
import {CatalogController} from './catalog.controller';
import {IntegrationsModule} from '../integrations/integrations.module';
@Module({imports: [IntegrationsModule], controllers: [CatalogController]})
export class CatalogModule {}
