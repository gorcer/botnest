
-- Get profit stat
select 
 t.dt, t.spendUSDT, t.profit, (t.profit / t.spendUSDT)
 from
 (
SELECT 
TO_CHAR(o."createdAt", 'YYYY-MM-DD') as dt,
sum(
case when type = 'buy' then amount2 else 0 end
) as spendUSDT,
sum(profit) as profit
from "order" o
group by dt
order by dt desc
) as t



-- Expected sell

select 
order_id,
"createdAt",
t."elapsedDays",
t."elapsedSeconds",
orderRate,
currentRate,
--(orderRate * (1 + (0.00075*2 + expectedProfit/100))) as expectedRate,
(amount2 * (1+expectedProfit/100))/amount1 as expectedRate,
currentProfit,
expectedProfit
from
(
SELECT 
"order".id as "order_id",
"order"."createdAt",
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
            ( ("strategy"."minYerlyProfit" / 31536000) * (extract(epoch from now()) - "order"."createdAtSec") )
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
                (("pair"."sellRate" / "strategy"."cellSize")::int * "strategy"."cellSize" ) as rateFrom,
                ((("pair"."sellRate" / "strategy"."cellSize")::int + 1) * "strategy"."cellSize") as rateTo,
                GREATEST(cast(strategy."orderAmount" as DECIMAL), "pair"."minAmount1") as amount1,
                "pair".id as "pairId",
                "pair".name as "pairName"
                 FROM "balance" "balance" INNER JOIN "pair" "pair" ON "pair"."currency2" = "balance".currency  INNER JOIN "strategy_buy_fillCells" "strategy" ON strategy."accountId" = balance."accountId"  LEFT JOIN "order" "order" ON 
                    "order"."accountId" = "balance"."accountId" and
                    "order".currency2 = "balance".currency and 
                    "order"."isActive" = true and
                    "order"."prefilled" < "order"."amount1" and
                    "order".rate >= (("pair"."sellRate" / "strategy"."cellSize")::int * "strategy"."cellSize" ) and 
                    "order".rate < ((("pair"."sellRate" / "strategy"."cellSize")::int + 1) * "strategy"."cellSize") 
                  WHERE 
                  -- "order".id is null AND 
                  -- "pair"."updatedAt" > CURRENT_TIMESTAMP - interval '10 seconds' AND 
                  "balance".amount > "pair"."minAmount2" AND "balance".amount > strategy."orderAmount" * "pair"."sellRate" AND "pair"."isActive" = true
            