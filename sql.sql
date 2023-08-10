
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



-- Expected rate
select 
order_id
createdAt,
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
"order"."id" AS "order_id",
"order"."createdAt",
(extract(epoch from now()) - "order"."createdAtSec")/60/60/24 as "elapsedDays",
(extract(epoch from now()) - "order"."createdAtSec") as "elapsedSeconds",
"order"."rate" as orderRate,
"pair"."buyRate" as currentRate,
"order".amount1,
("order".amount2 + "order".fee) as amount2,
100*((("pair"."buyRate" * "order".amount1*(1-pair.fee)) / ("order".amount2 + "order".fee))-1) as currentProfit,
case
          when
            (extract(epoch from now()) - "order"."createdAtSec") < 86400
          then
            ( 0.000009512937595 * (extract(epoch from now()) - "order"."createdAtSec") )
          else
            ( 0.000000951293760 * (extract(epoch from now()) - "order"."createdAtSec") )
        end as expectedProfit
FROM "order" "order" 
INNER JOIN "pair" "pair" ON "pair"."currency1" = "order".currency1 AND "pair"."currency2" = "order".currency2 
WHERE 
	"order".side = 'buy' and	
	"order"."createdAtSec" < extract(epoch from now()) AND 
	"order"."isActive" = true AND 
	"order"."prefilled" < "order"."amount1"
) as t
order by expectedRate;


-- Expected buy
SELECT 
"order".rate,
"pair"."sellRate" * (1-cast(0.001 as decimal)) as from,
 "pair"."sellRate" * (1+cast(0.001 as decimal)) as to,
                "balance"."accountId",
                "pair"."sellRate" as "rate",
                GREATEST(cast(0.0001 as DECIMAL), "pair"."minAmount1") as amount1,
                "pair".currency1,
                "pair".currency2
                 FROM "balance" "balance" INNER JOIN "pair" "pair" ON "pair"."currency2" = "balance".currency  
                 LEFT JOIN 
"order" "order" ON
                    "order".currency2 = "balance".currency and
                    "order"."isActive" = true and
                    "order"."prefilled" < "order"."amount1" and                   
                    "order".rate > "pair"."sellRate" * (1-cast(0.001 as decimal)) and
                    "order".rate < "pair"."sellRate" * (1+cast(0.001 as decimal))                     
WHERE 
--"order".id is null AND 
"balance".amount > "pair"."minAmount2" AND 
"balance".amount > 0.0001 * "pair"."sellRate"  
