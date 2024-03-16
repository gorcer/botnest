pg_dump -h localhost -U admin -W tradebot > ./tradebot.sql


-- Get profit stat
select 
 t.dt, 
 t.spendUSDT, 
 t.profit, 
 case when t.spendUSDT > 0 then
 	100*(t.profit / t.spendUSDT) 
 else 0 end	as pc
 from
 (
SELECT 
TO_CHAR(o."closedAt", 'YYYY-MM-DD') as dt,
sum(
case when side = 'buy' then amount2 else 0 end
) as spendUSDT,
sum(profit) as profit
from "order" o
group by dt
order by dt desc
) as t
where dt is not null



-- Expected sell
select 
order_id,
"createdAt",
t."elapsedDays",
t."elapsedSeconds",
orderRate,
currentRate,
("orderFee" + amount2 * (1+expectedProfit/100) + amount2*"pairFee")/amount1 as expectedRate,
currentProfit,
expectedProfit
from
(
SELECT 
"order".id as "order_id",
"order"."createdAt",
"order".fee as "orderFee",
"pair"."fee" as "pairFee",
          "order"."pairName",
          "order"."id",
          "order"."prefilled",
          "order"."accountId",
          "order"."amount1" - "order"."prefilled" as "needSell",
          "pair".id as "pairId",
          "order"."rate" as orderRate,
"pair"."buyRate" as currentRate,
"order".amount1,
("order".amount2 + "order".fee) as amount2,
          (extract(epoch from now()) - "order"."createdAtSec")/60/60/24 as "elapsedDays",
(extract(epoch from now()) - "order"."createdAtSec") as "elapsedSeconds",
100*((("pair"."buyRate" * "order".amount1*(1-pair.fee)) / ("order".amount2 + "order".fee))-1) as currentProfit,
case 
          when 
            (extract(epoch from now()) - "order"."createdAtSec") < 86400
          then  
            ( ("strategy"."minDailyProfit" / 31536000) * (extract(epoch from now()) - "order"."createdAtSec") )
          else  
            ( ("strategy"."minAnnualProfit" / 31536000) * (extract(epoch from now()) - "order"."createdAtSec") )
        end  as expectedProfit
       FROM "order" "order" 
       INNER JOIN "strategy_sell_awaitProfit" "strategy" ON strategy."accountId" = "order"."accountId"  
       INNER JOIN "pair" "pair" ON "pair"."id" = "order"."pairId" 
       WHERE "order".side = 'buy' AND 
--         "order".rate < "pair"."buyRate" AND 
         "order"."createdAtSec" < extract(epoch from now())+1 AND 
         "order"."isActive" = true AND 
         "order"."prefilled" < "order"."amount1"
) as t
order by expectedRate;


-- Expected buy

SELECT 
              "order".id,
				"order"."createdAt",
				"order".rate as orderRate,
                "balance"."accountId",
                "pair"."sellRate" as "rate",
                "strategy"."cellSize",
                ("pair"."sellRate" / "strategy"."cellSize")::int,
                (floor("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize" ) as rateFrom,
                (ceil("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize") as rateTo,
                GREATEST(cast(strategy."orderAmount" as DECIMAL), "pair"."minAmount1") as amount1,
                "pair".id as "pairId",
                "pair".name as "pairName"
                 FROM "strategy_buy_fillCells" "strategy" INNER JOIN "pair" "pair" ON strategy."pairId" = "pair"."id"  INNER JOIN "balance" "balance" ON strategy."accountId" = balance."accountId" and "balance"."currency" = "pair"."currency2" 
 LEFT JOIN "order" "order" ON
                    "order"."accountId" = "balance"."accountId" and
                    "order".currency2 = "balance".currency and
                    "order"."isActive" = true and
                    "order"."prefilled" < "order"."amount1" and
                    "order".rate >= (floor("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize" ) and      
                    "order".rate < (ceil("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize" ) 
                    WHERE 
                    "balance".available > "pair"."minAmount2" AND "balance".available > strategy."orderAmount" * "pair"."sellRate" AND "pair"."isActive" = true
            
                        