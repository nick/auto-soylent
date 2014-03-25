/**
 * Nonlinear Auto-Soylent Solver v0.2
 *
 * by  Alrecenk (Matt McDaniel) of Inductive Bias LLC (http://www.inductivebias.com)
 * and Nick Poulden of DIY Soylent (http://diy.soylent.me)
 *
 */

// This can be replaced with any of the recipes on http://diy.soylent.me
var recipeUrl = "http://diy.soylent.me/recipes/people-chow-301-tortilla-perfection";

var ingredientLength,
    targetLength, // Length of ingredient and target array (also dimensions of m)
    M,            // Matrix mapping ingredient amounts to chemical amounts (values are fraction per serving of target value)
    cost,         // Cost of each ingredient per serving
    w = .0001,    // Weight cost regularization (creates sparse recipes for large numbers of ingredient, use 0 for few ingredients)
    maxPerMin,    // Ratio of maximum value to taget value for each ingredient
    lowWeight,
    highWeight;   // How to weight penalties for going over or under a requirement

/**
 * Fitness function that is being optimized
 *
 * Note: target values are assumed as 1 meaning M amounts are normalized to be fractions of target values does not
 * consider constraints, those are managed elsewhere.
 *
 * Based on the formula (M * x-1)^2 + w *(x dot c) except that penalties are only given if above max or below min and
 * quadratically from that point.
 *
 * @author Alrecenk (Matt McDaniel) of Inductive Bias LLC (www.inductivebias.com) March 2014
 */
function f(x) {

	var output = createArray(targetLength),
	    totalError = 0;

	// M*x - 1
	for (var t = 0; t < targetLength; t++) {
		// Calculate output
		output[t] = 0;
		for (var i = 0; i < ingredientLength; i++) {
			output[t] += M[i][t] * x[i];
		}
		// If too low penalize with low weight
		if (output[t] < 1) {
			totalError += lowWeight[t] * (1 - output[t]) * (1 - output[t]);
		}
        else if (output[t] > maxPerMin[t]){ // If too high penalize with high weight
			totalError += highWeight[t] * (maxPerMin[t] - output[t]) * (maxPerMin[t] - output[t]);
		}
	}

	// Calculate cost penalty, |c*x|
	// but X is nonnegative so absolute values aren't necessarry
	var penalty = 0;
	for (var i = 0; i < ingredientLength; i++) {
		penalty += cost[i] * x[i];
	}

	return totalError + w * penalty;
}

/**
 * Gradient of f with respect to x.
 * Based on the formula 2 M^T(Mx-1) + wc except with separate parabolas for going over or under.
 * Does not consdier constraints, those are managed elsewhere.
 *
 * @author Alrecenk (Matt McDaniel) of Inductive Bias LLC (www.inductivebias.com) March 2014
 */
function gradient(x){

	var output = createArray(targetLength);

	// output = M*x
	for (var t = 0; t < targetLength; t++) {
		// Calculate output
		output[t] = 0;
		for (var i = 0; i < ingredientLength; i++) {
			output[t] += M[i][t] * x[i];
		}
	}

	// Initialize gradient
	var dx = [];
	for (var i = 0; i < ingredientLength; i++) {
		dx[i] = 0;
		for (var t = 0; t < targetLength; t++) {
			// M^t (error)
			if (output[t] < 1) { // If output too low calculate gradient from low parabola
				dx[i] += lowWeight[t] * M[i][t] * (output[t] - 1);
			}
            else if (output[t] > maxPerMin[t]) { // If output too high calculate gradient from high parabola
				dx[i] += highWeight[t] * M[i][t] * (output[t] - maxPerMin[t]);
			}
		}
		dx[i] += cost[i] * w; // + c w
	}
	return dx;
}

/**
 * Generates a recipe based on gradient descent minimzation of a fitness function cosisting of half parabola penalties
 * for out of range items and weighted monetary cost minimzation.
 *
 * @author Alrecenk (Matt McDaniel) of Inductive Bias LLC (www.inductivebias.com) March 2014
 */
function generateRecipe(ingredients, nutrientTargets) {

	// Initialize our return object: an array of ingredient quantities (in the same order the ingredients are passed in)
	var ingredientQuantities = [],
	    targetAmount = [], // Target amounts used to convert ingredient amounts to per serving ratios
	    targetName = [],
	    x = []; // Number of servings of each ingredient

	// Fetch the target values ignoring the "max" values and any nonnumerical variables
	for (var key in nutrientTargets) {
		var name = key,
		    value = nutrientTargets[key];

		if (name != "name" && name.substring(name.length - 4, name.length) != "_max" && value > 0) {
			targetName.push(name);
			targetAmount.push(value);
		}
	}

	maxPerMin = [];
	lowWeight = [];
	highWeight = [];

	// Initialize target amount maxes and mins along with weights.
	// There are some hardcoded rules that should be made configurable in the future.
	for (var t = 0; t < targetAmount.length; t++) {
		// If has a max for this element
		if (typeof nutrientTargets[targetName[t] + "_max"] > targetAmount[t]) {
			var maxvalue = nutrientTargets[targetName[t] + "_max"];
			maxPerMin[t] = maxvalue / targetAmount[t]; // Record it
		}
        else {
			maxPerMin[t] = 1000; // Max is super high for things that aren't limited
		}

		// Weight macro nutrients values higher and make sure we penalize for going over (ad hoc common sense rule)
		if (targetName[t] == "calories" || targetName[t] == "protein" || targetName[t] == "carbs" || targetName[t] == "fat") {
			lowWeight[t] = 5;
			highWeight[t] = 5;
			maxPerMin[t] = 1;
		}
        else {
			lowWeight[t] = 1;
			highWeight[t] = 1;
		}

		// Weird glitch where niacin isn't being read as having a max, so I hardcoded in this
		// should be removed when that is tracked down
		if (targetName[t] =="niacin"){
			maxPerMin[t] = 30.0 / 16.0;
		}
		// console.log(targetName[t] + " : " + targetAmount[t] +" --max ratio :" + maxPerMin[t] +" weights :" + lowWeight[t]+"," + highWeight[t]);
	}

	// Intitialize the matrix mapping ingredients to chemicals and the cost weights.
	// These are the constants necessary to evaluate the fitness function and gradient.

	ingredientLength = ingredients.length;
	targetLength = targetAmount.length;
	M = createArray(ingredientLength, targetLength);
	cost = [];

	for (var i = 0; i < ingredients.length; i++) {
		for (var t = 0; t < targetAmount.length; t++) {
			// Fraction of daily value of target t in ingredient i
			M[i][t] = ingredients[i][targetName[t]] / (targetAmount[t]);
		}

		// Initial x doesn't affect result but a good guess may improve speed
		x[i] = 1; // Initialize with one of everything

		// Cost per serving is cost per container * servings per container
		cost[i] = ingredients[i].item_cost*ingredients[i].serving / ingredients[i].container_size;
	}

	// Projected Gradient descent with halving step size, accepting largest step with improvement.
	// Could be made faster by moving to LBGS and implementing a proper inexact line search
	// but this method does guarantee convergence so those improvements are on the back burner
	console.log("Calculating Optimal Recipe...");

	var fv = f(x),
	    g = gradient(x),
	    iteration = 0;

	while (!done && iteration < 50000) { // Loops until no improvement can be made or max iterations
		iteration++;

		var done = false,
		    stepsize = 10, // Start with big step
		    linesearch = true;

		while (linesearch) {
			var newx = [];

			// Calculate new potential value
			for (var i = 0; i < x.length; i++) {
				newx[i] = x[i] - g[i] * stepsize;
				if (newx[i] < 0) {
					newx[i] = 0;
				}
			}

			var newf = f(newx); // Get fitness
			if (newf < fv) {    // If improvement then accept and recalculate gradient
				fv = newf;
				x = newx;
				g = gradient(x);
				linesearch = false; // exit line search
			}
			else {
				stepsize *= 0.5; // If bad then halve step size
				if (stepsize < 0.00000001) { // If stepsize too small then quit search entirely
					done = true;
					linesearch = false;
				}
				else { // otherwise continue line search
					linesearch = true;
				}
			}
		}
	}

	var g = gradient(x);
	// console.log("Final Fitness Gradient:");
	// for (var k = 0; k < g.length; k++) {
	// 	console.log(g[k]);
	// }

	// console.log("Servings of each ingredient:");
	var price = 0;
	for (var k = 0; k < g.length; k++) {
		// console.log(x[k].toFixed(4));
		price += x[k] * cost[k];
	}

	console.log("Price per day: $" + price.toFixed(2));

	// Map number of servings into raw quantities because that's what this function is supposed to return
	for (var i = 0; i < ingredients.length; i++) {
		ingredientQuantities[i] = x[i] * ingredients[i].serving;
	}

    return ingredientQuantities;
}

// Convenience function for preinitializing arrays because I'm not accustomed to working on javascript
function createArray(length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}



// Fetch recipe, pass to generateRecipe function and output results...

var request = require('superagent'), // Library to request recipe from diy.soylent.me
    Table = require('cli-table'),    // Library to output the results in a pretty way
    colors = require('colors');

console.log("\nFetching the recipe from the DIY Soylent website...");
request.get(recipeUrl + "/json?nutrientProfile=51e4e6ca7789bc0200000007", function(err, response) {
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
        head: ["Ingredient", "Official\nAmount", "Optimized\nAmount"]
    });

    for (i=0; i< ingredients.length; i++) {
        ingredientsTable.push([
            ingredients[i].name,
            ingredients[i].amount + " " + ingredients[i].unit,
            ingredientQuantities[i].toFixed(2) + " " + ingredients[i].unit
        ]);
    }

    console.log(ingredientsTable.toString());


    // Ignore the following nutrient properties
    var nutrientWhitelist = [
        'biotin', 'calcium', 'calories', 'carbs', 'chloride', 'cholesterol', 'choline', 'chromium', 'copper', 'fat',
        'fiber', 'folate', 'iodine', 'iron', 'maganese', 'magnesium', 'molybdenum', 'niacin', 'omega_3', 'omega_6',
        'panthothenic', 'phosphorus', 'potassium', 'protein', 'riboflavin', 'selinium', 'sodium', 'sulfur', 'thiamin',
        'vitamin_a', 'vitamin_b12', 'vitamin_b6', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k', 'zinc'
    ];

    // Output the nutrients.
    var nutrientsTable = new Table({
        style: { compact: true },
        head: ['Nutrient', 'Target', 'Max', 'Recipe', '% of Target']
    });

    // Loops over each nutrient in the target list
    for (var nutrient in nutrientTargets) {
        if (nutrientWhitelist.indexOf(nutrient) < 0) continue; // Skip over non-nutrient properties

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
            nutrient || '',                           // Nutrient Name
            nutrientTargets[nutrient] || '',          // Target amount
            nutrientTargets[nutrient + '_max'] || '', // Maximum amount
            nutrientInIngredients.toFixed(2) || '',   // Amount in Recipe
            pct || ''                                 // % of Target in recipe
        ]);
    }

    console.log(nutrientsTable.toString());

    // That's it!
});
