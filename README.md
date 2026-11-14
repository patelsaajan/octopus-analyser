# Octopus Analyser

## Motivation 

Recently my parents installed solar and a battery energy storage system (BESS) on their house. The system is the following:

- 6.6kwh solar system
- 16.6kwh battery storage (16kwh of useable storage)
- Octopus import and export tarrif
- Hypervolt 3 EV charger

The system was designed around their peak winter usage of 20kwh/day. It is expected that during that peak winter days we should get around 3-4kwh of solar plus the additional 16kwh of battery storage.

The question I want to investigate is around which Octopus export tariff is more porfitable for the house. There is two octopus plans that are suitable:

1. Outgoings Octopus - "Variable tariff currently paying a flat rate of 12p/kWh. Export whenever suits you and know you’re always getting a good price."
2. Octopus Flux - "An import and export tariff. Schedule your home battery to get the best rates for consuming and selling your energy during peak periods."

The summary of the plans can be seen below:

| Plan        | Times                     |
|             | 7pm-4pm     | 4pm-7pm     |
| ----------- | ----------- | ----------- |
| Outgoings   | 12 p/kwh    | 12 p/kwh    |
| Flux        | 9p p/kwh    | 16 p/kwh    |

The house is current on the flux plan meaning.

The system has been set up to do the following:

1. During the night on the cheap house tarrif (11:30pm to 5:30am) the BESS charges itself to 100%. At the current import cheap house tarrif (13/11/2026) that is 8p/kwh meaning the cost of charging is £1.28 for the BESS. 
2. During the day the system discharges as the house needs, any additional solar is used to top the BESS.
3. If the BESS system is fully charged and the solar system is generating surplus to the house requirements then it exports back to the grid. 
4. 4-7pm is considered peak exporting on the octopus flux plan. Meaning you get a higher export tarrif in those windows. So between 6pm and 7pm the system is set up to export till it hits 50% which should be enough in reserve till the night cheap tarrif. 

The plan is simple, utilising the Octopus developer API I want to create a visuable dashboard for the house useage and see if the current plan (flux) is the better choice to be on. 

## How it will work?

The current stack I am thinking of is a react + vite frontend deployed on cloudflare and since its personal household data I'm planning to block the page using Cloudflare Zero Trust which I haven't used before. Cloudflare Zero Trust block all request to the site unless they sign in with Cloudflare and are on a approved user list. 

Octopus provide two API option being GraphQL and a REST optioN. I plan to utilise the GraphQL because i've used it in the past and want to solidfy my knowledge in it. 



