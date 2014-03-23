
// Please see the README file for details on what's going on here...

var recipeUrl = "http://diy.soylent.me/recipes/people-chow-301-tortilla-perfection";

// This is the function you should re-write!
function generateRecipe(ingredients, nutrientTargets) {

    // Initialize our return object: an array of ingredient quantities (in the same order the ingredients are passed in)
    var ingredientQuantities = [];

    // Loop through our ingredient list and return a random amount of each one.
    // This should be replaced with some magical code which returns something useful, ie quantities of ingredients
    // which result in a complete nutrient profile instead of a random one.

    for (var i=0; i < ingredients.length; i++) {
        ingredientQuantities.push(Math.random() * ingredients[i].serving * 2);
    }

    return ingredientQuantities;
}


// Fetch recipe, pass to generateRecipe function and output results...

var request = require('superagent'), // Library to request recipe from diy.soylent.me
    Table = require('cli-table'),    // Library to output the results in a pretty way
    colors = require('colors');

console.log("\nFetching the recipe from the DIY Soylent website...");
request.get(recipeUrl + "/json", function(err, response) {
    if (err) {
        console.log("An error occurred", err);
        return;
    }

    console.log("Successfully fetched recipe.\n");

    var ingredients     = response.body.ingredients,
        nutrientTargets = response.body.nutrientTargets,
        i;

    // Here's where the magic happens...
    var ingredientQuantities = generateRecipe(ingredients, nutrientTargets);

    // Now lets output the results. First the ingredients.
    var ingredientsTable = new Table({
        style: { compact: true },
        head: ['Ingredient', 'Amount']
    });

    for (i=0; i< ingredients.length; i++) {
        ingredientsTable.push([
            ingredients[i].name,
            ingredientQuantities[i].toFixed(2) + ingredients[i].unit
        ]);
    }

    console.log(ingredientsTable.toString());


    // Ignore the following nutrient properties
    var nutrientBlacklist = ['_id', 'name', 'item_cost', 'source', 'url', 'unit', 'currency', 'asin', 'id'];

    // Output the nutrients.
    var nutrientsTable = new Table({
        style: { compact: true },
        head: ['Nutrient', 'Target', 'Max', 'Recipe', '% of Target']
    });

    // Loops over each nutrient in the target list
    for (var nutrient in nutrientTargets) {
        if (nutrientBlacklist.indexOf(nutrient) > 0) continue; // Skip over non-nutrient properties
        if (nutrient.indexOf("_max") > 0) continue;            // Skip over max-nutrient properties

        // Add up the amount of the current nutrient in each of the ingredients.
        var nutrientInIngredients = 0;
        for (j=0; j< ingredients.length; j++) {
            if (typeof ingredients[j][nutrient] == 'number') {
                nutrientInIngredients += ingredients[j][nutrient] * ingredientQuantities[j] / ingredients[j].serving;
            }
        }

        // Format percentages nicely. Cyan: too little. Green: just right. Red: too much
        var pct = (nutrientInIngredients / nutrientTargets[nutrient] * 100);
        if (pct < 100) pct = pct.toFixed(0).cyan.bold;
        else if (nutrientTargets[nutrient + '_max'] > 0 && nutrientInIngredients > nutrientTargets[nutrient + '_max']) pct = pct.toFixed(0).red.bold.inverse;
        else pct = pct.toFixed(0).green

        nutrientsTable.push([
            nutrient,                           // Nutrient Name
            nutrientTargets[nutrient],          // Target amount
            nutrientTargets[nutrient + '_max'], // Maximum amount
            nutrientInIngredients.toFixed(2),   // Amount in Recipe
            pct                                 // % of Target in recipe
        ]);
    }

    console.log(nutrientsTable.toString());

    // That's it!
});
