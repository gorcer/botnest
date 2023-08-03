import { Inject, Injectable, Scope } from "@nestjs/common";
import { BotService } from "./bot.service";


@Injectable()
export class TradeService {


	constructor(

		public bot: BotService,
		

	) { }

}