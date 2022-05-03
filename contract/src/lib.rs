/*
 * This is an example of a Rust smart contract with two simple, symmetric functions:
 *
 * 1. set_greeting: accepts a greeting, such as "howdy", and records it for the user (account_id)
 *    who sent the request
 * 2. get_greeting: accepts an account_id and returns the greeting saved for it, defaulting to
 *    "Hello"
 *
 * Learn more about writing NEAR smart contracts with Rust:
 * https://github.com/near/near-sdk-rs
 *
 */

// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{log, env, near_bindgen, setup_alloc, AccountId, Promise, PanicOnDefault};
use near_sdk::collections::{LookupMap, UnorderedSet};

setup_alloc!();

const PUZZLE_NUMBER: u8 = 1;

const PRIZE_AMOUNT: u128 = 5_000_000_000_000_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum AnswerDirection {
    Across,
    Down,
}

/// The origin (0,0) starts at the top left side of the square
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct CoordinatePair {
    x: u8,
    y: u8,
}

// {"num": 1, "start": {"x": 19, "y": 31}, "direction": "Across", "length": 8, "clue": "not far but"}
// We'll have the clue stored on-chain for now for simplicity.
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Answer {
    num: u8,
    start: CoordinatePair,
    direction: AnswerDirection,
    length: u8,
    clue: String,
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum PuzzleStatus {
    Unsolved,
    Solved { memo: String },
}

#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct Puzzle {
    status: PuzzleStatus,
    /// Use the CoordinatePair assuming the origin is (0, 0) in the top left side of the puzzle.
    answer: Vec<Answer>,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonPuzzle {
    /// The human-readable (not in bytes) hash of the solution
    solution_hash: String,  // ⟵ this field is not contained in the Puzzle struct
    status: PuzzleStatus,
    answer: Vec<Answer>,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct UnsolvedPuzzles {
    puzzles: Vec<JsonPuzzle>,
}


// TODO: dive into to later || using for callback
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

// Structs in Rust are similar to other languages, and may include impl keyword as shown below
// Note: the names of the structs are not important when calling the smart contract, but the function names are
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Welcome {
    // records: LookupMap<String, String>,
    // crossword_solution: String,
    owner_id: AccountId,
    puzzules: LookupMap<String, Puzzle>,
    unsolved_puzzles: UnorderedSet<String>,
}

//  trai Default must be set or using PanicOnDefault
// impl Default for Welcome {
//   fn default() -> Self {
//     Self {
//     //   records: LookupMap::new(b"a".to_vec()),
//       crossword_solution: "test_string".to_string(),
//     }
//   }
// }

#[near_bindgen]
impl Welcome {

    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        // let hashed_input = env::sha256(solution.as_bytes());
        // let hashed_input_hex = hex::encode(&hashed_input);
        // println!("hashed_input_hex: {:?}", hashed_input_hex);

        Self {
            // records: LookupMap::new(b"a".to_vec()),
            owner_id,
            puzzules: LookupMap::new(b"p"),
            unsolved_puzzles: UnorderedSet::new(b"u"),
        }
    }

    pub fn new_puzzle(&mut self, solution: String, answers: Vec<Answer>) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the owner may call this method");

        let hash_input = env::sha256(solution.as_bytes());
        let hashed_input_hex = hex::encode(&hash_input);

        let existing = self.puzzules.insert(&hashed_input_hex, &Puzzle { status: PuzzleStatus::Unsolved, answer: answers });
        assert!(existing.is_none(), "Puzzle already exists");
        self.unsolved_puzzles.insert(&hashed_input_hex);
    }

    #[private]
    pub fn my_callback(&mut self, #[callback] storage_balance: StorageBalance) {
        // …
    }

    pub fn get_puzzle_number(&self) -> u8 {
        PUZZLE_NUMBER
    }

    pub fn submit_solution(&mut self, solution: String, memo: String) -> Promise {
        let hash_input = env::sha256(solution.as_bytes());
        let hashed_input_hex = hex::encode(&hash_input);

        // check to see if the hashed asnwer is among the puzzle
        let mut puzzle = self.puzzules.get(&hashed_input_hex).expect("Not correct puzzle");

        // check if the puzzle is already solved. If it's unsolved, set the status to solved,
        // then proceed to update the puzzzle and pay the winner
        puzzle.status = match puzzle.status {
            PuzzleStatus::Unsolved => PuzzleStatus::Solved { memo: memo.clone() },
            _ => panic!("Puzzle already solved"),
        };

        // Reinsert the puzzle bacl in after we modified the status
        self.puzzules.insert(&hashed_input_hex, &puzzle);
        // Remove the puzzle from the unsolved list
        self.unsolved_puzzles.remove(&hashed_input_hex);

        log!(
            "Puzzle solved!\nSolution: {}\nMemo: {}",
            solution, memo
        );

        // Transfer the prize money to the winner
        Promise::new(env::predecessor_account_id()).transfer(PRIZE_AMOUNT)
    }

    pub fn get_puzzle_status(&self, solution_hash: String) -> Option<PuzzleStatus> {
        let puzzle = self.puzzules.get(&solution_hash);
        if puzzle.is_none() {
            return None;
        }
        Some(puzzle.unwrap().status)
    }

    pub fn get_unsolved_puzzles(&self) -> UnsolvedPuzzles {
        let solution_hashes = self.unsolved_puzzles.to_vec();
        let mut all_unsolved_puzzles = Vec::new();
        for hash in solution_hashes {
            let puzzle = self.puzzules.get(&hash).unwrap_or_else(|| env::panic(b"Puzzle not found"));
            let json_puzzle = JsonPuzzle {
                solution_hash: hash,
                status: puzzle.status,
                answer: puzzle.answer
            };
            all_unsolved_puzzles.push(json_puzzle);
        }
        UnsolvedPuzzles { puzzles: all_unsolved_puzzles }
    }

    // pub fn get_solution(&self) -> String {
    //     self.crossword_solution.clone()
    // }

    // pub fn set_solution(&mut self, solution: String) {
    //     self.crossword_solution = solution;
    // }

    // pub fn guess_solution(&mut self, solution: String) -> bool {
    //     let hashed_input = env::sha256(solution.as_bytes());
    //     let hashed_input_hex = hex::encode(&hashed_input);

    //     if hashed_input_hex == self.crossword_solution {
    //         env::log(format!("You guess right").as_bytes());
    //         true
    //     } else {
    //         env::log(format!("Incorrect! Try again").as_bytes());
    //         false
    //     }
    // }


    // pub fn set_greeting(&mut self, message: String) {
    //     let account_id = env::signer_account_id();

    //     // Use env::log to record logs permanently to the blockchain!
    //     env::log(format!("Saving greeting '{}' for account '{}'", message, account_id,).as_bytes());

    //     self.records.insert(&account_id, &message);
    // }

    // // `match` is similar to `switch` in other languages; here we use it to default to "Hello" if
    // // self.records.get(&account_id) is not yet defined.
    // // Learn more: https://doc.rust-lang.org/book/ch06-02-match.html#matching-with-optiont
    // pub fn get_greeting(&self, account_id: String) -> String {
    //     match self.records.get(&account_id) {
    //         Some(greeting) => greeting,
    //         None => "Hello".to_string(),
    //     }
    // }
}

/*
 * The rest of this file holds the inline tests for the code above
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 *
 * To run from contract directory:
 * cargo test -- --nocapture
 *
 * From project root, to run in combination with frontend tests:
 * yarn test
 *
 */
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, AccountId, VMContext};
    use near_sdk::test_utils::{get_logs, VMContextBuilder};

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::

    fn get_signer_account_id() -> String {
        "bob_near".to_string()
    }
    
    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice_near".to_string(),
            signer_account_id: "bob_near".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "carol_near".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
            epoch_height: 19,
        }
    }

    #[test]
    fn debug_get_hash() {
        // Basic set up for a unit test
        testing_env!(VMContextBuilder::new().build());

        // Using a unit test to rapidly debugand iterate
        let debug_solution = "near_test";
        let debug_hash_bytes = env::sha256(debug_solution.as_bytes());
        let debug_hash_string = hex::encode(debug_hash_bytes);

        println!("Let's debug: {:?}", debug_hash_string);
    }

    // #[test]
    // fn test_new_wellcom() {
    //     let context = get_context(vec![], false);
    //     testing_env!(context);
    //     let contract = Welcome::new("near_test".to_string());

    //     let debug_solution = "near_test";
    //     let debug_hash_bytes = env::sha256(debug_solution.as_bytes());
    //     let debug_hash_string = hex::encode(debug_hash_bytes);

    //     assert_eq!(contract.crossword_solution, debug_hash_string);
    // }

    // #[test]
    // fn set_then_get_greeting() {
    //     let context = get_context(vec![], false);
    //     testing_env!(context);
    //     let mut contract = Welcome::default();
    //     contract.set_greeting("howdy".to_string());
    //     assert_eq!(
    //         "howdy".to_string(),
    //         contract.get_greeting(get_signer_account_id())
    //     );
    // }

    // #[test]
    // fn get_default_greeting() {
    //     let context = get_context(vec![], true);
    //     testing_env!(context);
    //     let contract = Welcome::default();
    //     // this test did not call set_greeting so should return the default "Hello" greeting
    //     assert_eq!(
    //         "Hello".to_string(),
    //         contract.get_greeting("francis.near".to_string())
    //     );
    // }
}
