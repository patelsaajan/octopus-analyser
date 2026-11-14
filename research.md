# Research

# Octopus Docs. 

I haven't actually checked if what i plan to do is even feasiable with the Octopus API. All the data I would need is accessible via their app so im hoping that the GraphQL query documentation will show me a potential queries that i can utilise.

https://developer.oegb-kraken.energy/graphql/reference/queries/

Starting first with looking for a keyword like 'useage' but the queries I found we're not useful. Using the claude suggested supplyPointsInterface and it's generate playground for me (see ai.md for notes). After pluggin yesterday timestamps in i got a succesful response but it included both gas and electric useage. Having done it before I want to add a filter to the query so it only returns electrical useage. From looking at the respone back there is a field 1 level up from the readings which I believe I need to use to filter the response. 

"marketName" can either be "GBR_ELECTRICITY" or "GBR_GAS". In my case im looking to use "GBR_ELECTRICITY".

To my suprise there is no filter or where clause you can add to GraphQL






