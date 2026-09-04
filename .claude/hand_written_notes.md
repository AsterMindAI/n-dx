n-dx rework

This is a project given to the interns as a challenge to implement an Astermind ELM into en dashes n-dx program to help lessen the token usage. 

Original mission

What ive been doing.
- Ive set up two agents to compete on making seperate programs where they would implement an ELM into n-dx 
- These two agents are Archer and Knight with Realm being the manager of the two.
- The plan was to have Archer and Knight work on seperate versions of n-dx and work on classify.ts. This seemed to be the best place to put a 
    - Archer
        - TJ-A1 - ELM could work
            - Built a version that sits between classify.ts's algorithmic pass and its LLM fallback.
            - tokenized text - didnt clear target (60% percision @ 25% coverage on held out data)
            - direct numeric per archetype score vector (100% poercision @ 60% coverage)
        - TJ-A2 - better enhancing the ELM used in theory (nothing created)
            - how a trained model actually persists and refreshes at real ndx analyze
            - Knight helped here
        - TJ-A2 part 2
            - Added a structural zero evidence gaurd. this allows for the skipping of zero evidence vectors unconditionally, allowing for lower false positives
            - 
    - Knight
    - Knights whole instruction was basically to help Archer and "copy" what Archer was doing, but differently.
        - TJ-K1 - Similar to TJ-A1, Built with an ELM
            - Followed Archers ADR without copying what Archer wrote
            - Seemed to find trouble with the ELM.train() as it ignores real training data and classification.json as it loses the algorithmic pass's evidence for any file the LLM later relabels
            - Just like TJ-A1, K1 didnt clear the first target but cleared the second.
        - TJ-K2
            - Changing from trying to implement an ELM to changing the whole archetype taxonomy itself (improving the classification)
            - Where we currently are (8/27). Will update soon 
- Realm is constantly checking and comparing the two agents
- 


New Mission
-The purpose of this project wasnt to necessarily to implement an ELM into classify.ts, although this will still be tested throughly and continued.
-The purpose now is to improve the classification of classify.ts. 
- Archer will continue working on the ELM integration. Knight will be doing nothing, maybe helping archer in their endeavors. Same with Realm. A bare bones just trying to improve the classification will be done on a seperate space with a different agent. Might get Fable to look at it and see what it can do.