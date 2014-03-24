



// Please see the README file for details on what's going on here...

var recipeUrl = "http://diy.soylent.me/recipes/people-chow-301-tortilla-perfection";

var ingredientlength, targetlength ; // length of ingredient and target array (also dimensions of m)
var M ; //matrix mapping ingredient amounts to chemical amounts (values are fraction per serving of target value)
var cost ; // cost of each ingredient per serving
var w=.0001 ; //weight cost regularization (creates sparse recipes for large numbers of ingredient, use 0 for few ingredients)
var maxpermin; // ratio of maximum value to taget value for each ingredient
var lowweight,heighweight ; //how to weight penalties for going over or under a requirement


//fitness function that is being optimized
//note: target values are assumed as 1 meaning M amounts are normalized to be fractions of target values
//does not consider constraints, those are managed elsewhere
// Based on the formula (M*x-1)^2 +w *(x dot c)
//except that penalties are only given  if above max or below min and quadratically from that point
//written by Alrecenk (Matt McDaniel) of Inductive Bias LLC (www.inductivebias.com) March 2014
function f(x){

	var output = createArray(targetlength);
	var totalerror = 0 ;
	//M*x-1
	for (var t = 0; t < targetlength; t++) {
		//calculate output
		output[t] = 0 ;
		for (var i = 0; i < ingredientlength; i++) {
			output[t] += M[i][t] * x[i];
		}
		//if too low penalize with low weight
		if(output[t] < 1){
			totalerror+= lowweight[t]*(1-output[t]) * (1-output[t]) ;
		}else if( output[t] > maxpermin[t]){ //if too high penalize with high weight
			totalerror+= highweight[t]*(maxpermin[t]-output[t]) * (maxpermin[t]-output[t]) ;
		}
		
	}
	
	//calculate cost penalty, |c*x| 
	//but X is nonnegative so absolute values aren't necessarry
	var penalty = 0;
	for (var i = 0; i < ingredientlength; i++) {
		penalty += cost[i]*x[i];
	}
	
	return totalerror + w*penalty ;
}

//gradient of f with respect to x
//based on the formula 2 M^T(Mx-1) + wc exceptwith separate parabolas for going over or under
//does not consdier constraints, those are managed elsewhere
//written by Alrecenk (Matt McDaniel) of Inductive Bias LLC (www.inductivebias.com) March 2014
function gradient(x){
	
	var output = createArray(targetlength);
	
	//output = M*x
	for (var t = 0; t < targetlength; t++) {
		//calculate output
		output[t] = 0 ;
		for (var i = 0; i < ingredientlength; i++) {
			output[t] += M[i][t] * x[i];
		}
	}
	//initialize gradient
	var dx = [] ;
	for (var i = 0; i < ingredientlength; i++) {
		dx[i] = 0;
		for (var t = 0; t < targetlength; t++) {
			//M^t (error) 
			if(output[t] < 1){ // if output too low calculate gradient from low parabola
				dx[i] += lowweight[t]*M[i][t] * (output[t]-1);
			}else if( output[t] > maxpermin[t]){//if output too high calculate gradient from high parabola
				dx[i] += highweight[t]* M[i][t] * (output[t]-maxpermin[t]);
			}
		}
		dx[i] += cost[i]*w; // + c w
	}
	return dx ;
	
}

//generates a recipe based on gradient descent minimzation of a fitness function
//cosisting of half parabola penalties for out of range items
//and weighted monetary cost minimzation
//written by Alrecenk (Matt McDaniel) of Inductive Bias LLC (www.inductivebias.com) March 2014
function generateRecipe(ingredients, nutrientTargets){

	// Initialize our return object: an array of ingredient quantities (in the same order the ingredients are passed in)
	var ingredientQuantities = [];
	
	//target amounts used to convert ingredient amounts to per serving ratios
	var targetamount = [];
	var targetname = [];
	
	
	var x = []; // number of servings of each ingredient
	
	//fetch the target values ignoring the "max" values and any nonnumerical variables
	for (var key in nutrientTargets) {
		var name = key;
		var value = nutrientTargets[key];
		if (name != "name" && name.substring(name.length - 4, name.length) != "_max" && value > 0) {
			targetname.push(name);
			targetamount.push(value);
		}
	}
	
	maxpermin = [] ;
	lowweight = [] ;
	highweight = [] ;
	//initialize target amount maxes and mins along with weights
	//there are some hardcoded rules that should be made configurable in the future
	for (var t = 0; t < targetamount.length; t++) {
		//if has a max for this element
		if (typeof nutrientTargets[targetname[t] + "_max"] > targetamount[t]) {
			var maxvalue = nutrientTargets[targetname[t] + "_max"];
			maxpermin[t] = maxvalue / targetamount[t] ;//record it
		}else{//otherwise
			maxpermin[t] = 1000; // max is super high for things that aren't limited
		}
		
		//weight macro nutrients values higher and make sure we penalize for going over ( ad hoc common sense rule)
		if (targetname[t] == "calories" || targetname[t] == "protein" || targetname[t] == "carbs" || targetname[t] == "fat") {
			lowweight[t] = 5;
			highweight[t] = 5 ;
			maxpermin[t] = 1 ;
		}else {
			lowweight[t] =1;
			highweight[t] = 1 ;
		}
		
		//weird glitch where niacin isn't being read as having a max, so I hardcoded in this
		//should be removed when that is tracked down
		if(targetname[t] =="niacin"){
			maxpermin[t] = 30.0/16.0 ;
		}
		//console.log(targetname[t] + " : " + targetamount[t] +" --max ratio :" + maxpermin[t] +" weights :" + lowweight[t]+"," + highweight[t]) ;
	}
	
	//intitialize the matrix mapping ingredients to chemicals and the cost weights
	//These are the constants necessary to evaluate the fitness function and gradient
	ingredientlength = ingredients.length;
	targetlength = targetamount.length;
	M = createArray(ingredientlength, targetlength);
	cost = [] ;
	for (var i = 0; i < ingredients.length; i++) {
		for (var t = 0; t < targetamount.length; t++) {
			//fraction of daily value of target t in ingredient i
			M[i][t] = ingredients[i][targetname[t]] / (targetamount[t]);
		}
		//initial x doesn't affect result but a good guess may improve speed
		x[i] = 1; // initialize with one of everything 
		
		//cost per serving is cost per container * servings per container
		cost[i] = ingredients[i].item_cost*ingredients[i].serving / ingredients[i].container_size ;
	}
	
	
	//projected Gradient descent with halving step size, accepting largest step with improvement
	//Could be made faster by moving to LBGS and implementing a proper inexact line search
	//but this method does gaurantee convergence so those improvements are on the back burner
	console.log("Calculating Optimal Recipe...") ;
	var fv = f(x);
	var g = gradient(x);
	var iteration = 0;
	while (!done && iteration < 50000) { // loops until no improvement can be made or max iterations
		iteration++;
		
		var done = false;
		var stepsize = 10;//start with big step
		var linesearch = true;
		while (linesearch) {
			var newx = [];
			//calculate new potential value
			for (var i = 0; i < x.length; i++) {
				newx[i] = x[i] - g[i] * stepsize;
				if (newx[i] < 0) {
					newx[i] = 0;
				}
				
			}
			var newf = f(newx); // get fitness
			if (newf < fv) {//if improvement then accept and recalculate gradient
				fv = newf;
				x = newx;
				g = gradient(x);
				linesearch = false; // exit line search
			}
			else {
				stepsize *= 0.5; //if bad then halve step size
				if (stepsize < 0.00000001) {// if stepsize too small then quit search entirely
					done = true;
					linesearch = false;
				}
				else {//otherwise continue line search
					linesearch = true;
				}
			}
		}
	}
	
	var g = gradient(x);
	console.log("Final Fitness Gradient:") ;
	for (var k = 0; k < g.length; k++) {
		console.log(g[k]);
	}
	
	console.log("Servings of each ingredient:") ;
	var price = 0 ;
	for (var k = 0; k < g.length; k++) {
		console.log(x[k].toFixed(4));
		price += x[k] * cost[k] ;
	}
	
	console.log("Price per day:$" + price.toFixed(2)) ;
	

	//map number of servings into raw quantitites because that's what this function is supposed to return
	for (var i = 0; i < ingredients.length; i++) {
		ingredientQuantities[i] = x[i] * ingredients[i].serving;
	}
	
    return ingredientQuantities;
}

//convenience function for preinitializing arrays because I'm not accustomed to working on javascript
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
