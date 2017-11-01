const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;



const models = require('./models');


models.films.belongsTo(models.genres, {
  foreignKey: 'genre_id'
});

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {

  let limit = 10;
  if( req.query.limit ) {
    limit = parseInt(req.query.limit);
  }
  let offset = 0;
  if( req.query.offset ) {
    offset = parseInt(req.query.offset);
  }

  let filmId = req.params.id;
  // 1. find the film that was passed in
  models.films.findById(filmId)
    .then( (film) => {
      if( film ) {
        // 2. use the genre_id to find all films with that genre and within +/- 15 years
        let underFifteenYears = new Date(film.release_date);
        let overFifteenYears = new Date(film.release_date);

        models.films.findAll({
          where: {
            genre_id: film['genre_id'],
            release_date: {
              $and: {
                $gt: underFifteenYears.setFullYear(underFifteenYears.getFullYear() - 15)  ,
                $lt: overFifteenYears.setFullYear(overFifteenYears.getFullYear() + 15)
              }
            }
          },
          include: [models.genres]
        })
        .then( (results) => {
          // show only the films with the criteria given
          let matchedFilms = '';
          for( let i=0; i<results.length; i++ ) {
            matchedFilms += results[i].id + ',';
          }
          // get rid of last commas
          matchedFilms = matchedFilms.slice(0,-1);

          // API request
          let options = {
            uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${matchedFilms}`,
            json: true
          };

          // get reviews of films
          request.get(options, (err, response, body)=>{

            let reviews = response.body;

            for( let j=0; j<results.length; j++ ) {
              if( results[j].id === reviews[j].film_id ) {
                results[j].reviews = reviews[j].reviews;
              } else {
                console.log('Something went wrong');
              }
            }

            results = results.filter( (result) => {
              if( result.reviews.length >= 5 ) {
                return true;
              }
              return false;
            })

            results = results.filter( (result) => {
              if( calcAveRating(result.reviews) > 4.0 ) {
                return true;
              }
              return false;
            })

            let jsonResponse = []
            results.forEach( (result) => {
              jsonResponse.push({
                id: result.id,
                title: result.title,
                releaseDate: result.release_date,
                genre: result.genre.name,
                averageRating: Math.round( calcAveRating(result.reviews) * 100 ) / 100,
                reviews: result.reviews.length
              })
            })


            res.json({
              recommendations: jsonResponse.slice(offset, offset+limit),
              meta: {limit: limit, offset: offset}
            })
          });
    })
    .catch( (err) => {
      console.log(err);
      res.status(422).json({message: 'key is missing'});
    })
  }
  else {
    res.status(422).json({message: 'key missing'});
  }
  })
  .catch( (err) => {
    console.log(err);
    res.status(422).json({message: 'key is missing'});
  })
}

function calcAveRating( reviews ) {
  let totalRev = 0.0;
  let numberOfReviews = reviews.length;
  reviews.forEach( (review) => {
    totalRev += review.rating;
  });
  return totalRev / numberOfReviews;
}



app.use(function(req, res, next) {
  res.status(404).json({message: 'Page not found'});
});


module.exports = app;
