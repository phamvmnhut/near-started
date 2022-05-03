import 'regenerator-runtime/runtime'
import React from 'react'
import { login, logout } from './utils'
import './global.css'

import getConfig from './config'
const { networkId } = getConfig(process.env.NODE_ENV || 'development')

export default function App() {
  // use React Hooks to store greeting in component state
  const [greeting, set_greeting] = React.useState();
  // state crosswordSelected
  const [crosswordSelected, set_crosswordSelected] = React.useState({});

  let defaultData = {
    is_use: false,
    start: false,
    data: '',
    num: null,
  };

  const [solution, set_solution] = React.useState();
  const [guessData, setGuessData] = React.useState([]);

  // when the user has not yet interacted with the form, disable the button
  const [buttonDisabled, setButtonDisabled] = React.useState(true)
  const [buttonDisabled2, setButtonDisabled2] = React.useState(true)

  // after submitting the form, we want to show Notification
  const [showNotification, setShowNotification] = React.useState(false);

  const [funcName, setFuncName] = React.useState();

  const [gridData, set_gridData] = React.useState(null);
  const [updateGrid, set_updateGrid] = React.useState(false);

  function set_gridData_from(data) {
    // array answer
    let data_formated = Array(20).fill(0).map((_, index_x) => {
      return Array(20).fill(0).map((_, index_y) => {
        return defaultData;
      })
    });

    data.answer.forEach((item) => {
      // direction: "Down"
      // length: 5
      // num: 1
      // start: {x: 1, y: 1}
      let pos = {
        x: parseInt(item.start.x, 10),
        y: parseInt(item.start.y, 10),
      };

      data_formated[pos.x][pos.y] = {
        ...defaultData,
        is_use: true,
        start: true,
        num: item.num,
      };

      let length = parseInt(item.length, 10);
      if (item.direction === 'Down') {
        for (let i = 1; i < length; i++) {
          data_formated[pos.x + i][pos.y] = {
            ...defaultData,
            is_use: true,
          }
        }
      }
      if (item.direction === 'Across') {
        for (let i = 1; i < length; i++) {
          data_formated[pos.x][pos.y + i] = {
            ...defaultData,
            is_use: true,
          }
        }
      }
    });
    set_gridData(data_formated);
  }

  function changeClueAnswer(value, indexClue) {
    let clue = crosswordSelected.answer[indexClue - 1];
    let array_string = value.split('');
    let length = parseInt(clue.length, 10);
    // if (array_string.length !== length) {
    //   alert('length not match');
    //   return;
    // }

    let data_formated = gridData;
    let pos = {
      x: parseInt(clue.start.x, 10),
      y: parseInt(clue.start.y, 10),
    };

    if (clue.direction === 'Down') {
      for (let i = 0; i < length; i++) {
        let data = data_formated[pos.x + i][pos.y];
        data_formated[pos.x + i][pos.y] = {
          ...data,
          data: array_string[i],
        }
      }
    }
    if (clue.direction === 'Across') {
      for (let i = 0; i < length; i++) {
        let data = data_formated[pos.x][pos.y + i];
        data_formated[pos.x][pos.y + i] = {
          ...data,
          data: array_string[i],
        }
      }
    }
    set_gridData(data_formated);
    set_updateGrid(!updateGrid);
  }

  // The useEffect hook can be used to fire side-effects during render
  // Learn more: https://reactjs.org/docs/hooks-intro.html
  React.useEffect(
    () => {
      // in this case, we only care to query the contract when signed in
      if (window.walletConnection.isSignedIn()) {

        // window.contract is set by initContract in index.js
        window.contract.get_unsolved_puzzles({ account_id: window.accountId })
          .then(crosswordDatas => {
            if (crosswordDatas.puzzles.length > 0) {
              let data = crosswordDatas.puzzles[0];
              set_crosswordSelected(data);
              set_gridData_from(data);
            }
            // set_greeting(crosswordDatas)
          })
      }
    },

    // The second argument to useEffect tells React when to re-run the effect
    // Use an empty array to specify "only run on first render"
    // This works because signing into NEAR Wallet reloads the page
    []
  )

  // if not signed in, return early with sign-in prompt
  if (!window.walletConnection.isSignedIn()) {
    return (
      <main>
        <h1>Welcome to NEAR!</h1>
        <p>
          To make use of the NEAR blockchain, you need to sign in. The button
          below will sign you in using NEAR Wallet.
        </p>
        <p>
          By default, when your app runs in "development" mode, it connects
          to a test network ("testnet") wallet. This works just like the main
          network ("mainnet") wallet, but the NEAR Tokens on testnet aren't
          convertible to other currencies – they're just for testing!
        </p>
        <p>
          Go ahead and click the button below to try it out:
        </p>
        <p style={{ textAlign: 'center', marginTop: '2.5em' }}>
          <button onClick={login}>Sign in</button>
        </p>
      </main>
    )
  }

  return (
    // use React Fragment, <>, to avoid wrapping elements in unnecessary divs
    <>
      <button className="link" style={{ float: 'right' }} onClick={logout}>
        Sign out
      </button>
      <main>
        <h1>
          <label
            htmlFor="greeting"
            style={{
              color: 'var(--secondary)',
              borderBottom: '2px solid var(--secondary)'
            }}
          >
          </label>
          {' '/* React trims whitespace around tags; insert literal space character when needed */}
          {window.accountId}!
        </h1>


        {/* <h2>Greeting App</h2>
        <h5>Greeting to: {greeting}</h5>
        <form onSubmit={async event => {
          event.preventDefault()

          // get elements from the form using their id attribute
          const { fieldset, greeting } = event.target.elements

          // hold onto new user-entered value from React's SynthenticEvent for use after `await` call
          const newGreeting = greeting.value

          // disable the form while the value gets updated on-chain
          fieldset.disabled = true

          try {
            // make an update call to the smart contract
            await window.contract.set_greeting({
              // pass the value that the user entered in the greeting field
              message: newGreeting
            })
            setFuncName('set_greeting')
          } catch (e) {
            alert(
              'Something went wrong! ' +
              'Maybe you need to sign out and back in? ' +
              'Check your browser console for more info.'
            )
            throw e
          } finally {
            // re-enable the form, whether the call succeeded or failed
            fieldset.disabled = false
          }

          // update local `greeting` variable to match persisted value
          set_greeting(newGreeting)

          // show Notification
          setShowNotification(true)

          // remove Notification again after css animation completes
          // this allows it to be shown again next time the form is submitted
          setTimeout(() => {
            setShowNotification(false)
          }, 11000)
        }}>
          <fieldset id="fieldset">
            <label
              htmlFor="greeting"
              style={{
                display: 'block',
                color: 'var(--gray)',
                marginBottom: '0.5em'
              }}
            >
              Change greeting
            </label>
            <div style={{ display: 'flex' }}>
              <input
                autoComplete="off"
                defaultValue={greeting}
                id="greeting"
                onChange={e => setButtonDisabled(e.target.value === greeting)}
                style={{ flex: 1 }}
              />
              <button
                disabled={buttonDisabled}
                style={{ borderRadius: '0 5px 5px 0' }}
              >
                Save
              </button>
            </div>
          </fieldset>
        </form> */}

        <h2 style={{
          textAlign: 'center',
        }}>Crossword puzzle App</h2>
        <h5>Your guess:</h5>

        {
          guessData.map((guess, index) => {
            return (
              <div key={index}>
                <p>{guess.guess}: {guess.result ? "True" : "False"}</p>
              </div>
            )
          })
        }
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto',
        }}>
          <div>
            <h5>Solution this</h5>
            {
              crosswordSelected && crosswordSelected.answer && crosswordSelected.answer.map((answer, index) => {
                return (
                  <div key={answer.num}>
                    <p style={{
                      fontSize: '16px',
                    }}>No.{answer.num}: {answer.length} character(s)</p>
                    <p style={{
                      fontSize: '14px',
                    }}>{answer.clue}</p>
                    <input type="text" onChange={(e) => changeClueAnswer(e.target.value, answer.num)} />
                  </div>
                )
              })
            }
          </div>
          <div>
            {
              updateGrid != undefined && gridData != null && Array(20).fill(0).map((_, index_x) => {
                return (
                  <div key={index_x} style={{
                    display: 'flex',
                    margin: '1px',
                  }}>
                    {
                      Array(20).fill(0).map((v, index_y) => {
                        let data = gridData[index_x][index_y];
                        if (data.is_use) {
                          return (
                            <div style={{
                              padding: '2px',
                              height: "25px",
                              width: "25px",
                              backgroundColor: "#F3F2EF",
                              margin: '1px',
                              cursor: 'pointer',
                              position: "relative",
                              textAlign: "center",
                            }}
                            >{data.data}
                              <div style={{
                                position: 'absolute',
                                top: '0',
                                left: '0',
                                fontSize: '10px',
                              }}>{data.num}</div>

                            </div>
                          )
                        } else {
                          return (
                            <div style={{
                              padding: '2px',
                              height: "25px",
                              width: "25px",
                              backgroundColor: "white",
                              margin: '1px',
                            }}></div>
                          )
                        }
                      })
                    }
                  </div>
                )
              })
            }
          </div>

        </div>


        <form onSubmit={async event => {
          event.preventDefault()

          // get elements from the form using their id attribute
          const { fieldset, crossword } = event.target.elements

          // hold onto new user-entered value from React's SynthenticEvent for use after `await` call
          const newSolution = crossword.value

          // disable the form while the value gets updated on-chain
          fieldset.disabled = true

          try {
            // make an update call to the smart contract
            let result = await window.contract.submit_solution({
              // pass the value that the user entered in the solution field
              solution: newSolution,
              memo: "test"
            })
            setFuncName('guess_solution')
            setGuessData(guessData.concat({
              guess: newSolution,
              result: result
            }))
          } catch (e) {
            alert(
              'Something went wrong! ' +
              'Maybe you need to sign out and back in? ' +
              'Check your browser console for more info.'
            )
            throw e
          } finally {
            // re-enable the form, whether the call succeeded or failed
            fieldset.disabled = false
          }

          // update local `greeting` variable to match persisted value
          set_solution(newSolution)

          // show Notification
          setShowNotification(true)

          // remove Notification again after css animation completes
          // this allows it to be shown again next time the form is submitted
          setTimeout(() => {
            setShowNotification(false)
          }, 11000)
        }}>
          <fieldset id="fieldset">
            <label
              htmlFor="crossword"
              style={{
                display: 'block',
                color: 'var(--gray)',
                marginBottom: '0.5em'
              }}
            >
              Guess
            </label>
            <div style={{ display: 'flex' }}>
              <input
                autoComplete="off"
                defaultValue={solution}
                id="crossword"
                onChange={e => setButtonDisabled2(e.target.value === solution)}
                style={{ flex: 1 }}
              />
              <button
                disabled={buttonDisabled2}
                style={{ borderRadius: '0 5px 5px 0' }}
              >
                Guess
              </button>
            </div>
          </fieldset>
        </form>
      </main>
      {showNotification && <Notification func={funcName} />}
    </>
  )
}

// this component gets rendered by App after the form is submitted
function Notification({ func }) {
  const urlPrefix = `https://explorer.${networkId}.near.org/accounts`
  return (
    <aside>
      <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.accountId}`}>
        {window.accountId}
      </a>
      {' '/* React trims whitespace around tags; insert literal space character when needed */}
      called method: {func} in contract:
      {' '}
      <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.contract.contractId}`}>
        {window.contract.contractId}
      </a>
      <footer>
        <div>✔ Succeeded</div>
        <div>Just now</div>
      </footer>
    </aside>
  )
}
