# AI Usage 

For this project I am using claude-code CLI and possible the app if I need additional assitance or learning because I find the UI better for that.

Firstly, im going to send off claude to also get a feel for the docs so i can quickly identify potential queries. Octopus provide a GraphQL quiery documentation here https://developer.oegb-kraken.energy/graphql/reference/queries/.

Claude create and group all the queries and I asked it for a query where I can get "the electricity useage of the house brokwn down per hour"

Claude suggest three things

1. supplyPoints query
2. consumption in app
3. or using a smart meter telemetry

Points 2 and 3 are not what I was looking to achieve. The query in 1 is now deprecated and is being removed on or after 2027-01-23. Instead the docs pointed me towards supplyPointsInterface which looked promising. 

To test the endpoint I asked claude to build a Octopus friendly GraphQL endpoint test with the goal to convert it later into the app. Claude provide a test query of viwer to test my API keys were working. Claude even went a step futher and would auto-populate the the variable for $accountNumber with the env var for me. One oversight it had was when I was entering the variables and did not enter the account number the varaible checker for the query sent a warning that I have added the account number but the query did succeed. What claude set up was that until you hit run the accountNumber wasn't being added. It changed it's approach so that it utilised a useEffect in AccountNumberVariable.tsx for 'accountVariable' during:

1. page load
2. changes to the editor
3. when the editor pane is frist create

if its not in there then it adds it in and if it is then it exits early out of a check. It feels a little excessive and alot of checks but its only test code so not worth my time fixing it. 


Error: Failed to obtain Kraken token: [{"message":"Variable '$key' of required type 'String!' was not provided.","locations":[{"line":1,"column":11}]}]

