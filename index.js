const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request-promise'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

const models = require('./models');

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
// need to get the film passed in and then use the key genre_id to find all films with that genre
function getFilmRecommendations(req, res) {
  let keys = Object.keys(req.query);
  let filmId = req.params.id;

  models.films.findFilmById(filmID)
    .then( (film) => {
      let recentDate = new Date(film.release_date);
      let laterDate = new Date(film.release_date);

      recentDate.setFullYear(recentDate.getFullYear() + 15);
      laterDate.setFullYear(laterDate.getFullYear() - 15);

      models.film.findAll({
        attributes: ['id', 'title', 'release_date', 'genre_id'],
        where: {
          genre_id: film['genre_id'],
          release_date: {
            $and: {
              $gt: laterDate,
              $lt: recentDate
            }
          }
        },
      })
      .then( (results) => {
        recommendedFilms(results)
        .then( (reviews) => {
          res.json({'recommendations': reviews})
        })
      });
    })
    .catch( (err) => {
      res.status(422);
      res.json( {message: '"message" key missing!'});
    })

}

async function recommendedFilms(films) {
  let review = films.map( (film) => {
    return await request.get(`http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${film.id}`)
  })
  return review;
}

app.use(function(req, res, next) {
  console.logt('route missing');
  res.status(404).json({message: '"message" key missing!'});
});

module.exports = app;
