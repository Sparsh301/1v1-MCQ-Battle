const express = require('express');
const auth = require('../middleware/authMiddleware');
const Game = require('../models/Game');
const MCQ = require('../models/MCQ');
const router = express.Router();

// Create a new game
router.post('/', auth, async (req, res) => {
  try {
    const newGame = new Game({
      owner: req.user.id,
      status: 'waiting',
    });
    await newGame.save();
    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).send('Server error');
  }
});

// Join a game
router.post('/:gameId/join', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game) return res.status(404).send('Game not found');
    if (game.status !== 'waiting') return res.status(400).send('Game is not in waiting state');
    if (game.participants.includes(req.user.id)) return res.status(400).send('Already joined');

    game.participants.push(req.user.id);
    if (game.participants.length > 1) game.status = 'active';
    await game.save();

    res.json(game);
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).send('Server error');
  }
});

// Get all games
router.get('/', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).send('Server error');
  }
});

// Get details of a specific game, including MCQs
// Add MCQs to a game
// Add MCQs to a game
router.post('/:gameId/add-mcqs', auth, async (req, res) => {
  try {
    const { mcqIds } = req.body;
    const game = await Game.findById(req.params.gameId);

    // Filter out MCQs that are already present
    const newMcqIds = mcqIds.filter((id) => !game.mcqs.includes(id));

    if (newMcqIds.length > 0) {
      game.mcqs.push(...newMcqIds);
      await game.save();
    }

    res.status(200).json(game);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while adding MCQs' });
  }
});

  // Get details of a specific game, including MCQs
  router.get('/:gameId', async (req, res) => {
    try {
      const game = await Game.findById(req.params.gameId).populate('mcqs');
      console.log("HELLO MCQS")
      console.log('Fetched game details:', game); // Debugging log
      if (!game) return res.status(404).send('Game not found');
      res.json(game);
    } catch (error) {
      console.error('Error fetching game details:', error);
      res.status(500).send('Server error');
    }
  });
  
  

// Submit an answer for a game
// routes/game.js
router.post('/:gameId/answer', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game) return res.status(404).send('Game not found');

    const mcq = await MCQ.findById(req.body.mcqId);
    if (!mcq) return res.status(404).send('MCQ not found');

    const isCorrect = mcq.options.some(option => option.body === req.body.answer && option.is_correct);

    // Update score
    let userScore = game.scores.find(score => score.userId.toString() === req.user.id);
    if (userScore) {
      if (isCorrect) {
        userScore.score += 1;
      }
      userScore.hasSubmitted = true;
    } else {
      game.scores.push({ userId: req.user.id, score: isCorrect ? 1 : 0, hasSubmitted: true });
    }

    await game.save();
    res.json({ correct: isCorrect });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).send('Server error');
  }
});


router.post('/:gameId/start',auth,async(req,res)=>{
  try{
    const game=await Game.findById(req.params.gameId);
    if(!game) return res.status(404).send('Game not found');

    game.status='active';
    game.startTime=new Date();
    await game.save();
    res.json(game);

  }
  catch(error){
    console.error('Error starting game:',error);
    res.status(500).send('Server Error')
  }
})
// Backend: End Game Route
// routes/game.js
router.post('/:gameId/end', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId).populate('scores.userId', 'username');

    if (!game) return res.status(404).send('Game not found');

    // Check if both participants have submitted
    const allSubmitted = game.scores.every(score => score.hasSubmitted);

    if (!allSubmitted) {
      return res.status(400).send('Not all participants have submitted their answers');
    }

    game.status = 'completed';
    game.endTime = new Date();
    await game.save();

    const results = game.scores.map(score => ({
      user: score.userId.username,
      score: score.score
    }));

    const winner = results.reduce((max, result) => result.score > max.score ? result : max, results[0]);
    const loser = results.find(result => result.user !== winner.user);
    const scoreDifference = winner.score - (loser ? loser.score : 0);

    res.json({
      results,
      winner,
      loser,
      scoreDifference
    });
  } catch (error) {
    console.error('Error ending game:', error);
    res.status(500).send('Server Error');
  }
});



module.exports = router;
