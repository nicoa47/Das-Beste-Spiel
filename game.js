// initialization - setup global vars

var game_state = "choose_mode"; // choose_mode instructions1 instructions2 game highscores
var hover_arrows_menu = [];
var best_five_array; // for highscores

// game-feel, not game-play related
var n_steps_in_tread = 6;
var slogans_enabled = true; // for safety reasons possible to switch it off...
var slogans = [
    "Mir platzt gleich der Arsch",
    "HÖMMA!",
    "Das müssen wir jetzt sofort klären, SOFORT!",
    "Da krieg ich Puls!"
];
var curse_dur = 2.5; // speech bubble visibility in seconds
var xscale = 1;
var yscale = 1;

// gameplay-relevant parameters
var cost_per_door = 60000;
var time_left; // 3.5 minutes seem realistic
var n_floors;
var n_offices_per_floor;
var floor_height;
var money; // realistic start: 500000
var min_awake_dur;
var max_awake_dur;
var walk_speed;
var cost_of_sleep_per_person_per_frame; // careful: time in frames, not seconds
var boss_productivity_per_person_per_frame; // gain of money
var scare_tolerance; // how near can coworkers come to boss to not be scared?
var door_check_dur; // seconds to wait in front of each door
var stairway_w; 
var hallway_w;

// physics
var goal_tolerance; // never smaller than 0.5*walk_speed! left and right of goal

// containers and class instances (objects)
var coworkers;
var new_coworkers; // in case of upgrade: differentiate between old and new coworkers
// because identity of new coworkers must be defined first
var stories;
var doors;
var doors_path; // gets emptied when a door is reached
var boss_door; // has special properties (or rather reduced functions)
var boss; // gets instantiated in Story class (already placed in correct door :)
var grass;

// vars that keep track of game states
var current_pos;
var startTime;
var endTime, secondsElapsed;

var skycolor = "blue";

var tapped_active = false;

// add event listeners
// document.addEventListener("mousemove", mousemove);
document.addEventListener("mousedown", mousedown);
document.addEventListener("mousemove", mousemove);
document.addEventListener("touchstart", tapped);
document.addEventListener("touchend", not_tapped);
window.addEventListener('orientationchange', resizeCanvas, false);
window.addEventListener('resize', resizeCanvas, false);



// classes

class Text {
    constructor(label, pos) {
        this.label = label;
        this.pos = pos; // {x: 0, y: 0};
        this.color = "white";
        this.size = 10; // start really small!
        this.val = 0;
        if (isNumber(label)) {
            this.val = label;
        }
        this.align = "center";
    }
    render() {
        draw_canvas_text_flex(this.label, this.pos, this.color, this.size, this.align);
    }
}

class Opportunity {
    constructor(type, active) {
        this.type = type;
        this.active = active;
        this.horizontal_lines = 1;
        this.vertical_lines = 1;
        this.worth = 0;
        if (this.type == "door") {
            this.vertical_lines = 3;
            // get x position
            var x_pos = building.stairway2_start_x + building.stairway_width + canv_w/12;
            // get y position
            var start_y = canv_h - building.building_height - 0.5*grass.height;
            var end_y = start_y + building.building_height;
            var y_pos = start_y + (end_y - start_y)/2;
            this.worth = building.n_floors*cost_per_door;
        }
        if (this.type == "floor") {
            this.horizontal_lines = 3;
            // get x position
            var x_pos = canv_w/2;
            // get y position
            var y_pos = canv_h - building.building_height - 0.5*grass.height - canv_h/40 - canv_h/25;
            this.worth = n_offices_per_floor*cost_per_door;
        }
        
        this.w = this.horizontal_lines*(canv_w/8);
        this.h = (canv_w/35)*this.vertical_lines + (canv_w/50);
        this.pos = {x: Math.min(x_pos, canv_w - this.w/2), y: y_pos};
        this.x1 = this.pos.x - this.w/2;
        this.x2 = this.pos.x + this.w/2;
        this.y1 = this.pos.y - this.h/2;
        this.y2 = this.pos.y + this.h/2;
    }
    clicked_on(pos) {
        if (pos.x >= this.x1 && pos.x <= this.x2 && pos.y >= this.y1 && pos.y <= this.y2) {
            if (this.active) {
                return true;
            }
        } // else
        return false;
    }
    render() {
        if (this.type == "door") {

            // plural
            var add = "";
            if (building.n_floors > 1) add = "S";
            
            draw_textbox(["BÜRO"+add, "KAUFEN", String((cost_per_door*building.n_floors)/1000)+" K"], this.pos, 1, this.active);
        }
        if (this.type == "floor") {
            
            draw_textbox(["ETAGE KAUFEN "+String((cost_per_door*n_offices_per_floor)/1000)+" K"], this.pos, 3, this.active);
        }
    }
}

class Timer extends Text {
    constructor(start_time) {
        super(start_time, {x: canv_w - 20, y: canv_h/6 - canv_h/50});// {x:canv_w/2 - 30, y:50}
        this.size = canv_h/6;
        this.label = start_time;
        this.second = 1;
        this.align = "right";
    }
    highscore() {
        var score = bank_account.balance;
        // read out highscores

        // put highscore in list (if new or good enough)

        // var hs_ind = get_ind_of_highscore(score, highscores);

        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                var best_five = this.responseText;
                best_five_array = best_five.split("|a||b|")[0]; // eliminate empty rows
                best_five_array = best_five_array.split("|b|");
                best_five_array.pop();
            }
        }
        xmlhttp.open("GET", "load_highscores.php", false);
        xmlhttp.send();

        // check if in top five:
        var hs_ind = get_ind_of_highscore(score, get_scores(best_five_array));

        if (hs_ind == "append") {

            // append to database

            var name = window.prompt("Well done! Put your name in here: ", "");

            // handle case when pressed "cancel" --> therefore "try"
            try {
                name.replace("|", ""); // make sure splitting works correctly...
                if (name.length > 25) {
                    name = name.slice(0,24);
                }

                var xmlhttp = new XMLHttpRequest();
                xmlhttp.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200) {
                        var best_five = this.responseText;
                        best_five_array = best_five.split("|a||b|")[0]; // eliminate empty rows
                        best_five_array = best_five_array.split("|b|");
                        best_five_array.pop();
                    }
                }
                xmlhttp.open("GET", "add_to_highscores.php?q="+name+"|"+String(score), false);
                xmlhttp.send();
            } catch {}

            // reload scores from database

            var xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    var best_five = this.responseText;
                    best_five_array = best_five.split("|a||b|")[0]; // eliminate empty rows
                    best_five_array = best_five_array.split("|b|");
                    best_five_array.pop();
                }
            }
            xmlhttp.open("GET", "load_highscores.php", false);
            xmlhttp.send();

        }

        // change state
        game_state = "highscores";

    }
    update(seconds_elapsed) { // assuming a timer
        this.second -= seconds_elapsed;
        if (this.second <= 0) {
            this.label -= 1;
            this.second = 1;
        }
        if (this.label <= 0) {
            // game over
            bank_account.gameover();
        }
    }
}

class CoworkerStateText extends Text {
    constructor(label, pos, color, speed) {
        super(label, pos);
        this.color = color; // lightblue
        this.max_dist = 0.075*canv_h; // units it is allowed to float
        var startx = this.pos.x;
        var starty = this.pos.y;
        this.start_pos = {x: startx, y: starty};//{x: pos.x, y: pos.y}; // make copy, else linked!
        this.start_size = this.size;
        this.speed = speed; // px per frame in each axis (0.2 for sleep)
        this.size_increase = 0.002*canv_h; // size increase per frame
    }
    distance() {
        // distance to start
        var x_dist = this.start_pos.x - this.pos.x;
        var y_dist = this.start_pos.y - this.pos.y;
        return Math.sqrt(x_dist*x_dist + y_dist*y_dist);
    }
    reset() { // else positions somehow add up?
        this.pos = {x: this.start_pos.x, y: this.start_pos.y}; // again use copy
        this.size = this.start_size;
    }
    update() {
        // move to upper left
        this.pos.x += this.speed;
        this.pos.y -= this.speed;
        // increase size until half distance is met
        if (this.distance() < this.max_dist/2) {
            this.size += this.size_increase;
        } else if (this.distance() > this.max_dist/2) {
            this.size -= this.size_increase;
        }
        // restart at position if max dist is reached
        if (this.distance() > this.max_dist) {
            this.reset();
        }
    }
}

class SleepText extends CoworkerStateText {
    constructor(pos) {
        super("z", pos, "lightblue", 0.0001*canv_w);
    }
}

class OldTalkText extends CoworkerStateText {
    constructor(pos) {
        super("bla", pos, "darkred", 1.2);
        this.max_dist = 50; // units it is allowed to float
    }
}

class TalkText extends Text {
    constructor(door) {
        super("bla", {x: door.door_x_pos + 0.5*door.door_width, y: door.start_y + 0.5*door.door_height});
        // - 10: considering that text is not centered
        this.start_pos = {x: door.door_x_pos + 0.5*door.door_width, y: door.start_y + 0.5*door.door_height};
        this.color = "black";
        this.pos_list = [];
        this.seconds_elapsed = 0;
        this.size = 0.05*canv_h;
        this.door = door;
        this.max_texts = 2;
        this.bla_dur = 0.7;
    }
    update(seconds_elapsed) {
        this.seconds_elapsed += seconds_elapsed;
        if (this.seconds_elapsed > this.bla_dur) {
            this.seconds_elapsed = 0;
            var randaddx = Math.random()*this.door.door_width - 0.5*this.door.door_width;
            var randaddy = Math.random()*this.door.door_height - 0.5*this.door.door_height;
            var new_pos = {x: this.start_pos.x + randaddx, y: this.start_pos.y + randaddy};
            // always keep maximum of 3 texts
            if (this.pos_list.length >= this.max_texts) {
                this.pos_list.shift();
            }
            this.pos_list.push(new_pos);
        } 
    }
    render() {
        for (let index = 0; index < this.pos_list.length; index++) {
            var p = this.pos_list[index];
            this.pos = p;
            Text.prototype.render.call(this);
        }
    }
}

class BankAccount {
    constructor(start_capital) {
        this.balance = start_capital;
        this.opportunities = [];
        this.prev_balance = start_capital; // to get change velocity
        this.rate = 1;
        this.rad = get_rad_for_arrow(this.rate);
        this.maxrate;
        this.color = "lime";
        this.sleeping_n = 0;
        this.size = canv_h/10;
        this.pos = {x: 3*canv_w/7, y: canv_h/(6*2) + this.size/2};
        this.align = "right";
    }
    update() {
        this.maxrate = boss_productivity_per_person_per_frame*coworkers.length;
        this.prev_balance = this.balance;
        // reduce money by amount of sleeping people
        this.sleeping_n = 0;
        for (let index = 0; index < coworkers.length; index++) {
            if (!coworkers[index].working) {
                this.sleeping_n += 1;
            }
        }
        this.balance -= this.sleeping_n*cost_of_sleep_per_person_per_frame;

        // raise money by working boss
        if (boss.working) {
            var cw_work_count = 0;
            for (let index = 0; index < coworkers.length; index++) {
                if (coworkers[index].working) {
                    cw_work_count++;
                }
            }
            this.balance += boss_productivity_per_person_per_frame*cw_work_count;
        }

        // set color depending on money amount
        if (this.balance < 100000) {
            this.color = "red";
        } else if (this.balance < 300000) {
            this.color = "yellow";
        } else {
            this.color = "lime";
        }

        // get rate and rad for arrow
        this.rate = get_rate(this.balance - this.prev_balance, -this.maxrate, this.maxrate);
        var goal_rad = get_rad_for_arrow(this.rate);
        // ensure gradual movement of arrow
        if (round_digits(goal_rad, 2) < round_digits(this.rad, 2)) {
            this.rad -= 0.005;
        }
        if (round_digits(goal_rad, 2) > round_digits(this.rad, 2)) {
            this.rad += 0.005;
        }

        // draw buying opportunities
        this.opportunities = []; // reset
        // only given if boss is in office and no one is sleeping/talking
        var everybody_productive = true;
        if (!boss.in_office) {
            everybody_productive = false;
        } else {
            for (let index = 0; index < coworkers.length; index++) {
                const cw = coworkers[index];
                if (cw.sleeping || cw.talking) {
                    everybody_productive = false;
                    break;
                }
            }
        }

        // 1. door(s)
        if (this.balance > cost_per_door*building.n_floors && n_offices_per_floor < 8) {
            this.opportunities.push(new Opportunity("door", everybody_productive))
        }
        // 2. floor
        if (this.balance > cost_per_door*n_offices_per_floor && building.n_floors < 6) {
            this.opportunities.push(new Opportunity("floor", everybody_productive))
        }


        // set game over
        if (this.balance <= 0) {
            this.gameover();
        }

    }
    gameover() {
        // this.balance = "GAME OVER   ".concat(this.balance);
        timer.highscore();
    }
    render() {
        draw_canvas_text_flex(String(this.balance).concat(" €"), this.pos, this.color, this.size, this.align);
        draw_arrow(this.rad);
        for (let index = 0; index < this.opportunities.length; index++) {
            const opp = this.opportunities[index];
            opp.render();
        }
    }
}

class Mover {
    constructor() {
    }
    distance(p1, p2) {
        var xdist = p2.x - p1.x;
        var ydist = p2.y - p1.y;
        return Math.sqrt(xdist*xdist + ydist*ydist);
    }
}

class Building {
    constructor() {
        this.stairway_width = stairway_w;
        this.hallway_length = hallway_w;
        this.n_floors = n_floors;
        this.height = floor_height;
        // derived vars
        this.stairway1_start_x = canv_w/2 - this.hallway_length/2 - this.stairway_width;
        this.stairway2_start_x = canv_w/2 + this.hallway_length/2;
        this.building_height = floor_height*this.n_floors;
    }
    render() {
        // stairways boxes
        draw_rect_outline({x: this.stairway1_start_x, y: canv_h - this.building_height - 0.5*grass.height},
            this.stairway_width, this.building_height, "black", "white");
        draw_rect_outline({x: this.stairway2_start_x, y: canv_h - this.building_height - 0.5*grass.height},
            this.stairway_width, this.building_height, "black", "white");
    }
}

class Stairs extends Building {
    constructor(side, start_x, end_x, start_y) {
        super();
        this.coords = [{x: start_x, y: start_y}];
        this.step_length = this.stairway_width/n_steps_in_tread;
        this.step_height = this.height/2/n_steps_in_tread;

        if (side == 0) { // left hand stairway
            let new_x = this.coords[this.coords.length-1].x;
            // move to left first
            while (new_x > end_x + 1) {
                new_x = this.coords[this.coords.length-1].x - this.step_length;
                this.coords.push({x: new_x, y: this.coords[this.coords.length-1].y});
                let new_y = this.coords[this.coords.length-1].y + this.step_height;
                this.coords.push({x: this.coords[this.coords.length-1].x, y: new_y});
            }
            // then to right
            end_x += this.stairway_width;
            while (new_x < end_x) {
                new_x = this.coords[this.coords.length-1].x + this.step_length;
                this.coords.push({x: new_x, y: this.coords[this.coords.length-1].y});
                let new_y = this.coords[this.coords.length-1].y + this.step_height;
                this.coords.push({x: this.coords[this.coords.length-1].x, y: new_y});
            }
        }

        if (side == 1) { // right hand stairway --> here is error
            // move to right first
            let new_x = this.coords[this.coords.length-1].x;
            // TODO figure out why "- 1" necessary
            while (new_x < end_x - 1) {
                new_x = this.coords[this.coords.length-1].x + this.step_length;
                this.coords.push({x: new_x, y: this.coords[this.coords.length-1].y});
                let new_y = this.coords[this.coords.length-1].y + this.step_height;
                this.coords.push({x: this.coords[this.coords.length-1].x, y: new_y});
            }
            // then to left
            end_x -= this.stairway_width;
            while (new_x > end_x) {
                new_x = this.coords[this.coords.length-1].x - this.step_length;
                this.coords.push({x: new_x, y: this.coords[this.coords.length-1].y});
                let new_y = this.coords[this.coords.length-1].y + this.step_height;
                this.coords.push({x: this.coords[this.coords.length-1].x, y: new_y});
            }
        }

    }
    render() {
        draw_path(this.coords, "black")
    }
}

class Story extends Building { // here also doors are added
    constructor(floor_n, after_upgrade) {
        var after_upgrade = after_upgrade || false;
        super();
        this.n_doors = n_offices_per_floor;
        this.floor_n = floor_n;
        // derived vars
        this.start_x = canv_w/2 - this.hallway_length/2; // only hallway
        this.end_x = this.start_x + this.hallway_length; // only hallway
        this.start_y = canv_h - this.floor_n*this.height; // only hallway
        // derived vars - stairs
        this.stairs1 = new Stairs(0, this.stairway1_start_x + this.stairway_width, 
            this.stairway1_start_x, this.start_y - this.height - 0.5*grass.height);
        this.stairs2 = new Stairs(1, this.stairway2_start_x, 
            this.stairway2_start_x + this.stairway_width, this.start_y - this.height - 0.5*grass.height);
        // derived vars - door coordinates
        let boss_placed = false;
        for (let index = 0; index < this.n_doors; index++) {
            // don't add boss door to list (first in topmost floor)
            if (this.floor_n == n_floors - 1 && !boss_placed) {
                boss_door = new Door(index, this.start_x, this.start_y - 0.5*grass.height, -1, this.floor_n);
                boss_door.color = "brown";
                boss = new DaBoss(boss_door.goal, boss_door);
                boss_placed = true;
            } else {
                var new_door = new Door(index, this.start_x, this.start_y - 0.5*grass.height, doors.length, this.floor_n);
                // spawn the correct coworker in working state --> only if not upgraded building
                new_door.coworkers_in_room.push(new CoWorker(new_door, after_upgrade));
                doors.push(new_door);
            }
        }
    }
    render() {
        // stairs, walls and doors
        // 1. hallway walls
        draw_rect_outline({x: this.start_x, y: this.start_y - this.height - grass.height/2},
            this.hallway_length, this.height, "black", "white");
        // 2. doors --> rendered separately in draw_all (unique list)
        // 3. stairs (only if not top story)
        if (this.floor_n < this.n_floors - 1) {
            this.stairs1.render();
            this.stairs2.render();
        }
    }
}

class Door extends Building { // "extends Story" leads to recursion problems unfortunately
    constructor(door_n, start_x, start_y, ind, floor) {
        super();
        this.door_n = door_n; // number of door on this floor
        this.door_width = this.hallway_length/(n_offices_per_floor*3); //24;
        this.door_height = 0.6*floor_height;
        this.start_x = start_x; // hallway, not door!
        this.start_y = start_y - this.door_height;
        this.working_color = "orange";
        this.color = this.working_color;
        this.ind = ind; // index of door in list of all doors
        this.floor = floor;
        // initialize state variables
        this.labelled = false;
        // initialize state variables
        this.coworkers_in_room = [];
        // derived vars - left x coordinate
        let door_dist = this.hallway_length / (n_offices_per_floor + 1);
        let start_pos = door_dist + start_x - 0.5*this.door_width;
        this.door_x_pos = start_pos + this.door_n*door_dist;
        // edge coordinates
        this.x1 = this.door_x_pos;
        this.x2 = this.x1 + this.door_width;
        this.y1 = this.start_y;
        this.y2 = this.y1 + this.door_height;
        this.goal = {x: this.x1 + this.door_width/2, y: this.y2}; // feet center coordinate
        this.center = {x: this.x1 + this.door_width/2, y: this.y1 + this.height/2};
        // for rendering
        this.z = new SleepText({x: this.center.x, y: this.center.y - 0.25*this.door_height}); // for rendering sleeping
        this.bla = new TalkText(this); // for rendering talking
    }
    clicked_on(pos) { // returns bool
        if (pos.x >= this.x1 && pos.x <= this.x2 && pos.y >= this.y1 && pos.y <= this.y2) {
            return true;
        } // else
        return false;
    }
    same_door(other) { // returns true if the two are the same doors
        if(this.x1 != other.x1 || this.y1 != other.y1) {
            return false;
        } // else
        return true;
    }
    label(num) { // sets number value and switch to render label true
        this.labelled = true;
        this.num = num;
    }
    update(seconds_elapsed) {
        // if any coworkers in door are sleeping: step forward sleeping animation
        for (let index = 0; index < this.coworkers_in_room.length; index++) {
            if (this.coworkers_in_room[index].sleeping) {
                this.z.update();
                break;
            }
        }
        // if any coworkers in door are talking: step forward talking animation
        for (let index = 0; index < this.coworkers_in_room.length; index++) {
            if (this.coworkers_in_room[index].talking) {
                this.bla.update(seconds_elapsed);
                break;
            }
        }
    }
    render() {
        draw_rect_outline({x: this.door_x_pos, y: this.start_y},
            this.door_width, this.door_height, "black", this.color);
    }
    render_text() {
        // separate function so that no doors occlude sleep Zs
        // if any coworkers in door are talking: show talking animation
        for (let index = 0; index < this.coworkers_in_room.length; index++) {
            if (this.coworkers_in_room[index].talking) {
                this.bla.render();
                break;
            }
        }
        // if any coworkers in door are sleeping: show sleeping animation
        for (let index = 0; index < this.coworkers_in_room.length; index++) {
            if (this.coworkers_in_room[index].sleeping) {
                this.z.render();
                // set color to grey
                this.color = "lightgrey";
                break;
            } else if (this.coworkers_in_room[index].talking) {
                this.color = "lightgrey";
            } else { // coworkers are actually working 
                this.color = this.working_color;
            }
        }
    }
    render_walk_path() {
        if (this.labelled) {
            var padding = ((floor_height - this.door_height) - canv_h/15)/2;
            draw_canvas_text_flex(this.num, {x: this.x1 + this.door_width/2, y: this.y1 - padding}, "red", canv_h/15, "center");
        }
    }
    // render_path_doors() { // delete, only debugging...
    //     draw_rect_outline({x: this.door_x_pos, y: this.start_y},
    //         this.door_width, this.door_height, "black", "yellow");
    //     draw_circ(10, this.goal, "red");
    // }
}

class Person extends Mover {
    constructor() {
        super();
        this.pos = {x: canv_w/2 - 60, y: canv_h/2};
        this.head_r = floor_height/20;
        this.height = floor_height/2.5 - (floor_height/2.5)/5;
        this.width = 2.75*this.head_r;
        this.body_l = floor_height/8;
        this.arm_rel_pos_body = 0.2; // percentage on body line where arms start
        this.head_color = "white";
        this.walk_speed = walk_speed;
        // derived vars
        this.decap_height = this.height - 2*this.head_r;
        this.leg_height = this.decap_height - this.body_l;
        this.arm_joint_height = this.leg_height + (1 - this.arm_rel_pos_body)*this.body_l;
        this.goal_tolerance = this.walk_speed/2;
        // state variables
        this.in_stairway = false;
        this.middle_stairs_reached = false;
        this.stairway_points = [{x: 0, y: 0}, {x: 0, y: 0}, {x: 0, y: 0}];
        this.stairway_step_1 = {x: 0, y: 0};
        this.stairway_step_2 = {x: 0, y: 0};
        this.stairs1_len = 0;
        this.stairs2_len = 0;
        // initialization values
        this.working = true;
        this.in_office = true;
        this.sleeping = false;
        this.talking = false;
        this.scared = false;

        this.dest = new Door(-1, 0, 0, -1, -1);
        this.side = 0; // middle
    }
    get_story() { // mostly when in stairway
        for (let index = 0; index < stories.length; index++) {
            if (this.pos.y <= stories[index].start_y && this.pos.y > stories[index].start_y - stories[index].height) {
                // stories[index].highlight = true;
                return index;
            }
            // else {
            //     stories[index].highlight = false;
            // }
        }
    }
    get_story_y(building) {
        var story = this.get_story();
        return canv_h - building.height*story - 0.5*grass.height;
    }
    stairway_turn() {
        // just switch p1 and p3
        var p3_buffer = this.stairway_points[2];
        this.stairway_points[2] = this.stairway_points[0];
        this.stairway_points[0] = p3_buffer;
        // in this case: switch whether middle was reached or not
        this.middle_stairs_reached = !this.middle_stairs_reached;
        // reverse y direction of steps
        this.stairway_step_1.y = -this.stairway_step_1.y;
        this.stairway_step_2.y = -this.stairway_step_2.y;
    }
    set_stairway_points(vert_dir, side, building) {
        if (side == -1) { var x_init = building.stairway1_start_x + building.stairway_width; }
        else {var x_init = building.stairway2_start_x; }
        // y dependent on whether in stairway or not
        var y_init = this.get_story_y(building);
        var p1 = {x: x_init, y: y_init};
        var p2 = {x: x_init + side*building.stairway_width-side*this.width*0.5, y: y_init + vert_dir*building.height/2};
        var p3 = {x: x_init, y: y_init + vert_dir*building.height};
        this.stairway_points[0] = p1;
        this.stairway_points[1] = p2;
        this.stairway_points[2] = p3;
        // set the steps
        // create vectors
        var vec1 = {x: this.stairway_points[1].x - this.stairway_points[0].x, y: this.stairway_points[1].y - this.stairway_points[0].y};
        var vec2 = {x: this.stairway_points[2].x - this.stairway_points[1].x, y: this.stairway_points[2].y - this.stairway_points[1].y};
        // normalize and scale vector by walking speed to get new position add
        this.stairs1_len = Math.sqrt(vec1.x*vec1.x + vec1.y*vec1.y);
        this.stairs2_len = Math.sqrt(vec2.x*vec2.x + vec2.y*vec2.y);
        var vec1_norm = {x: vec1.x/this.stairs1_len, y: vec1.y/this.stairs1_len};
        var vec2_norm = {x: vec2.x/this.stairs2_len, y: vec2.y/this.stairs2_len};
        // get next step position
        this.stairway_step_1 = {x: vec1_norm.x*this.walk_speed, y: vec1_norm.y*this.walk_speed};
        this.stairway_step_2 = {x: vec2_norm.x*this.walk_speed, y: vec2_norm.y*this.walk_speed};
        this.in_stairway = true;
    }
    stairway_walking() {
        // maybe person needs to take a turn...
        // necessary if y of third stairway point not closer to dest than first stairway point
        if (Math.abs(this.stairway_points[0].y - this.dest.goal.y) < Math.abs(this.stairway_points[2].y - this.dest.goal.y)) {
            this.stairway_turn();
        }
        // keep walking on first vec as long as distance is less than stairs
        if (!this.middle_stairs_reached) { // first half
            if (this.distance(this.pos, this.stairway_points[0]) <= this.stairs1_len) {
                this.pos.x += this.stairway_step_1.x;
                this.pos.y += this.stairway_step_1.y;
            } else {
                this.middle_stairs_reached = true;
            }
        } else { // second half
            if (this.distance(this.pos, this.stairway_points[1]) <= this.stairs2_len) {
                this.pos.x += this.stairway_step_2.x;
                this.pos.y += this.stairway_step_2.y;
            } else {
                // when finished: reset variables
                this.middle_stairs_reached = false;
                this.in_stairway = false;
                this.pos.y = this.stairway_points[2].y;
            }
        }
    }
    choose_closest_stairs(start_x, end_x) { // left or right given doors are not in same floor
        // note: building coordinates neglected because everything is centered
        var left = start_x + end_x;
        var right = (canv_w - start_x) + (canv_w - end_x);
        if (!this.scared) { // only rational navigation decision when calmed down
            if (left < right) {
                return -1; // left
            } // else
            return 1; // right
        } else if (this.scared && boss.pos.y == this.pos.y) { // same floor
            // if scared: choose stairs that are away from boss
            if (boss.pos.x < this.pos.x) {
                return 1; // right
            } else if (boss.pos.x > this.pos.x) {
                return -1; // left
            } else {
                // same position (i.e. when forced out of door) -->
                // head start anyway, go to logical direction
                if (left < right) {
                    return -1; // left
                } // else
                return 1; // right
            }
        } else { // scared & not on same floor as boss --> logical direction
            if (left < right) {
                return -1; // left
            } // else
            return 1; // right
        }
    }
    walk_route(building, dest) {
        this.dest = dest;
        // note: in overall update function already checked this there are doors in path list
        // choose the direction where boss should walk
        // choose closest flight of stairs
        var dir = this.choose_closest_stairs(this.pos.x, this.dest.goal.x);
        // get vertical direction
        var vert_dir = 0;
        if (this.dest.goal.y > this.pos.y) { vert_dir = 1; }
        else if (this.dest.goal.y < this.pos.y) { vert_dir = -1; }
        // first check whether in stairway; if yes, finish walking program
        if (this.in_stairway) {
            this.stairway_walking();
        } else if (Math.round(this.dest.goal.y) != Math.round(this.pos.y)) { // needs to go to stairs
            // walk to stairs or up the stairs
            if (this.pos.x >= building.stairway1_start_x + building.stairway_width &&
                this.pos.x <= building.stairway2_start_x) { // in hallway
                    this.pos.x += dir*this.walk_speed;
            } else { // in stairway
                this.set_stairway_points(vert_dir, dir, building);
                // this.start_stairway_animation(vert_dir, dir, building);
            }
        }
        else if (this.dest.goal.x + this.goal_tolerance > this.pos.x) { // needs to walk right
            this.pos.x += this.walk_speed;
        }
        else if (this.dest.goal.x - this.goal_tolerance < this.pos.x) { // needs to walk left
            this.pos.x -= this.walk_speed;
        }
        // exact match (within tolerance) of position
        if (this.pos.x >= this.dest.goal.x - this.goal_tolerance &&
            this.pos.x <= this.dest.goal.x + this.goal_tolerance &&
            Math.round(this.pos.y) == Math.round(this.dest.goal.y)) {
            this.door_reached(this.dest);
        }
    }
    rescale(new_w, new_h) {

        // appearance adjustment
        this.head_r = floor_height/20;
        this.height = floor_height/2.5 - (floor_height/2.5)/5;
        this.width = 2.75*this.head_r;
        this.body_l = floor_height/8;
        this.arm_rel_pos_body = 0.2; // percentage on body line where arms start
        this.walk_speed = walk_speed;
        // derived vars
        this.decap_height = this.height - 2*this.head_r;
        this.leg_height = this.decap_height - this.body_l;
        this.arm_joint_height = this.leg_height + (1 - this.arm_rel_pos_body)*this.body_l;
        this.goal_tolerance = this.walk_speed/2;

        // position rescale
        // gradual y adjustment if in stairway
        // gradual x adjustment if not in office
        // preparation
        var old_hallway_w = 5*canv_w/8;
        var old_hallway_start_x = (canv_w - old_hallway_w)/2;
        var old_hallway_end_x = old_hallway_start_x + old_hallway_w;
        var new_hallway_start = (new_w - hallway_w)/2;
        var old_stairway_w = canv_w/8;
        // TODO check if this.dest.goal adjusted already
        var dir = this.choose_closest_stairs(this.pos.x, this.dest.goal.x);
        // distinction based on dir
        if (dir < 0) { var old_stairway_start_x = old_hallway_start_x + dir*old_stairway_w; }
        else { var old_stairway_start_x = old_hallway_end_x; }
        if (dir < 0) { var new_stairway_start_x = new_hallway_start + dir*stairway_w; }
        else { var new_stairway_start_x = new_hallway_start + hallway_w; }

        if (this.in_office) {
            this.pos = {x: this.door.goal.x, y: this.door.goal.y};
        } else if (!this.stairway_walking) {
            this.pos.y = this.get_story_y(building);
            // x derivation
            var subtr_x = this.pos.x - old_hallway_start_x;
            var new_rel_x = (subtr_x/old_hallway_w)*hallway_w;
            this.pos.x = new_rel_x + new_hallway_start;
        } else {
            // y derivation
            var new_y = (this.pos.y/canv_h)*new_h;
            this.pos.y = new_y;
            // x derivation
            var subtr_x = this.pos.x - old_stairway_start_x;
            var new_rel_x = (subtr_x/old_stairway_w)*stairway_w;
            this.pos.x = new_rel_x + new_stairway_start_x;
            var vert_dir = 0;
            // set the new stairway points
            if (this.dest.goal.y > this.pos.y) { vert_dir = 1; }
            else if (this.dest.goal.y < this.pos.y) { vert_dir = -1; }
            this.set_stairway_points(vert_dir, dir, building);
        }

    }
    render(label) {

        var label = label || "";

        // placeholder: strichmaennchen
        // head
        draw_circ_outline(this.head_r, {x: this.pos.x, y: this.pos.y - (this.height - this.head_r)},
        "black", this.head_color);
        draw_canvas_text_flex(label, {x: this.pos.x, y: this.pos.y - (this.height - this.head_r)}, "red", 20);
        // body
        draw_line([{x: this.pos.x, y: this.pos.y - this.leg_height},
            {x: this.pos.x, y: this.pos.y - this.decap_height}], "black");
        // legs
        draw_line([{x: this.pos.x, y: this.pos.y - this.leg_height},
            {x: this.pos.x - this.width/2, y: this.pos.y}], "black");
        draw_line([{x: this.pos.x, y: this.pos.y - this.leg_height},
            {x: this.pos.x + this.width/2, y: this.pos.y}], "black");
        // arms
        draw_line([{x: this.pos.x, y: this.pos.y - this.arm_joint_height},
            {x: this.pos.x - this.width/2, y: this.pos.y - this.arm_joint_height + this.leg_height}], "black");
        draw_line([{x: this.pos.x, y: this.pos.y - this.arm_joint_height},
            {x: this.pos.x + this.width/2, y: this.pos.y - this.arm_joint_height + this.leg_height}], "black");
    }
}

class CoWorker extends Person {
    constructor(door, after_upgrade) {
        var after_upgrade = after_upgrade || false;
        super();
        if (!after_upgrade) {
            this.ind = coworkers.length;
        } else {
            this.ind = new_coworkers.length;
        }
        this.door = door;
        this.door_ind = door.ind; // check if in own office
        // this.home = door.goal; // to find back to correct door
        this.pos = {x: door.goal.x, y: door.goal.y}; // init at "home" --> linked? try to make copy
        this.floor = door.floor;
        // state variables
        this.base_speed = this.walk_speed; // for resetting it later
        // add to list of coworkers --> only if not upgraded, i.e. first initialization
        if (!after_upgrade) {
            coworkers.push(this);
        } else {
            // keep the old coworker list, add to new list
            new_coworkers.push(this);
        }
    }
    controlled() {
        // always by boss when he knocks on door where this coworker currently is in
        // reset awake time and focus time
        this.awake_time_left = this.awake_time;
        this.focus_time_left = this.focus_time;
        if (this.sleeping) {
            this.sleeping = false;
        }
        if (this.talking && !this.in_own_office()) {
            // run from office --> reduce numbers of coworkers in room
            let new_cw_list = [];
            for (let index = 0; index < doors[this.door_ind].coworkers_in_room.length; index++) {
                let cw = doors[this.door_ind].coworkers_in_room[index];
                // only reappend coworker if not this
                if (cw.ind != this.ind) {
                    new_cw_list.push(cw);
                }
            }
            doors[this.door_ind].coworkers_in_room = new_cw_list;
            // set flags
            this.scared = true;
            this.talking = false;
            this.in_office = false;
        } else if (this.talking) {
            this.talking = false;
        } else if (!this.in_office) {
            this.scared = true;
        }
    }
    in_own_office() {
        if (!this.in_office) {
            return false;
        } else {
            if (this.door_ind == this.door.ind) {
                return true;
            } else {
                return false;
            }
        }
    }
    door_reached(dest) {
        // calm down no matter what office
        this.scared = false;
        this.in_office = true;
        this.pos = {x: dest.goal.x, y: dest.goal.y}; // make copy, otherwise linked?
        // set current door
        this.door_ind = dest.ind;
        if (!this.in_own_office()) { // reached a co-worker's door
            // go into room
            doors[dest.ind].coworkers_in_room.push(this);
            // coworkers that are already in room: wake up
            for (let index = 0; index < doors[dest.ind].coworkers_in_room.length; index++) {
                coworkers[dest.coworkers_in_room[index].ind].talking = true;
                coworkers[dest.coworkers_in_room[index].ind].sleeping = false;
            }
        } else { // walked back to office
            this.working = true;
            doors[this.door.ind].coworkers_in_room = [this];
        }
    }
    escape() {
        // function called when coworker too close to boss
        // is scared, runs away from boss (1) and back to his/her office (2)
        this.scared = true;
    }
    update(seconds_elapsed) {
        // debug
        // if (this.scared) {
        //     this.head_color = "lightblue";
        // } else {
        //     this.head_color = "white";
        // }
        // set current story
        this.floor = this.get_story();
        // set walking speed and adjust tolerance
        if (this.scared && this.walk_speed == this.base_speed) {
            this.walk_speed *= 1.5;
            this.goal_tolerance = this.walk_speed/2;
        } else if (!this.scared && this.walk_speed > this.base_speed) {
            this.walk_speed /= 1.5;
            this.goal_tolerance = this.walk_speed/2;
        }
        // check state
        // working if in own office and alone and not sleeping
        if (this.in_office && !this.sleeping && !this.talking && this.in_own_office()) {
            this.working = true;
        } else { // at least one condition is not met
            this.working = false;
        }
        // if working --> set the other flags to false (TODO: check if necessary...)
        if (this.working) {
            this.sleeping = false;
            this.talking = false;
        }
        // grow tiredness over time if awake & in office
        if (this.working) {
            this.awake_time_left -= seconds_elapsed;
            if (this.type == 1) { // ADHD type... walkers
                this.focus_time_left -= seconds_elapsed;
                if (this.focus_time_left <= 0) {
                    this.working = false;
                    this.in_office = false;
                    this.scared = false; // to distinguish what caused walking outside the office
                    doors[this.door.ind].coworkers_in_room = [];
                }
            }
            if (this.awake_time_left <= 0) {
                // set asleep
                this.working = false;
                this.sleeping = true;
            }
        }
        // can't be sleeping and talking at the same time... well my roommate can
        if (this.sleeping) { this.talking = false; }
        if (this.talking) { this.sleeping = false; }
        // step forward route
        if (!this.in_office) {
            if (this.scared) { // = woken up by boss
                this.walk_route(building, this.door);
            } else { // = walking out of boredom to other coworker's door
                this.walk_route(building, this.match_coworker.door);
            }
        }
    }
    render() {
        if (!this.in_office) {
            Person.prototype.render.call(this);
        }

    }
    // debug_render() {
    //     if (this.type == 1) {
    //         draw_rect_outline({x: this.match_coworker.door.door_x_pos, y: this.match_coworker.door.start_y},
    //             this.match_coworker.door.door_width, this.match_coworker.door.door_height, "black", "yellow");
    //         draw_circ(10, this.match_coworker.door.goal, "red");
    //     }
    // }
}

class DaBoss extends Person {
    constructor(pos, door) {
        super();
        this.pos = pos;
        this.head_color = "red";
        this.floor = door.floor;
        this.door = door;
        // initialize state variables
        this.working = true;
        this.checking = false; // small time to wait in front of door
        this.check_timer = door_check_dur;
        this.check_door = door; // when checking, keeps track which door is checked
        this.cursing = false; // speech bubble
        this.cursing_text = "";
        this.cursing_time_remaining = curse_dur;
    }
    door_reached(dest) {
        this.pos = {x: dest.goal.x, y: dest.goal.y}; // make copy, otherwise linked?
        this.check_door = dest;
        if (doors_path.length > 0) { // reached a co-worker's door
            doors[doors_path[0].ind].labelled = false;
            doors_path.shift(); // removes first element
            // redraw the labels
            for (let index = 0; index < doors.length; index++) {
                if (doors[index].labelled) {
                    doors[index].num -= 1;
                }
            }
            // wait a few moments in front of each door
            this.checking = true;
        } else { // walked back to office
            this.working = true;
            this.in_office = true;
            this.cursing = false;
        }
    }
    set_bubble_text() {
        var rand_ind = Math.floor(Math.random()*slogans.length);
        this.cursing_text = slogans[rand_ind];
        this.cursing = true;
        this.cursing_time_remaining = curse_dur;
    }
    update(building, doors_path, boss_door, seconds_elapsed) {
        // set current story
        this.floor = this.get_story();
        // count down speech bubble visibility
        if (this.cursing) {
            this.cursing_time_remaining -= seconds_elapsed;
            if (this.cursing_time_remaining <= 0) {
                this.cursing = false;
            }
        }
        // if in checking mode, wait a few moments in front of each door
        if (this.checking) {
            // count down timer --> if time up, set checking to false
            this.check_timer -= seconds_elapsed;
            if (this.check_timer <= 0) {
                // continue walking
                this.checking = false;
                this.check_timer = door_check_dur;
                // control coworkers if they are in office
                for (let index = 0; index < this.check_door.coworkers_in_room.length; index++) {
                    // set up speech bubble
                    if (coworkers[this.check_door.coworkers_in_room[index].ind].talking && !this.cursing) {
                        this.set_bubble_text();
                    }
                    coworkers[this.check_door.coworkers_in_room[index].ind].controlled();
                }
            }
        } else {
            if (doors_path.length > 0) {
                this.working = false;
                this.in_office = false;
                this.walk_route(building, doors_path[0]);
            } else { // no doors left --> walk back to office
                this.walk_route(building, boss_door);
            }
        }

        // scare coworkers in hallway
        if (!this.in_office) {
            for (let index = 0; index < coworkers.length; index++) {
                // given that meeting outside office
                if (!coworkers[index].in_office) {
                    if (get_distance(this.pos, coworkers[index].pos) < scare_tolerance) {
                        coworkers[index].controlled();
                    }
                }
                // if (this.pos.y == coworkers[index].pos.y && !coworkers[index].in_office) {
                //     if (Math.abs(this.pos.x - coworkers[index].pos.x) < scare_tolerance) {
                //         coworkers[index].controlled();
                //     }
                // }
            }
            // // otherwise, check in stairway
            // if (this.in_stairway) {
            //     var boss_stairway_side = this.choose_closest_stairs(this.pos.x, this.pos.x);
            //     for (let index = 0; index < coworkers.length; index++) {
            //         const cw = coworkers[index];
            //         // given that on same floor and meeting outside office
            //         var cw_stairway_side = cw.choose_closest_stairs(cw.pos.x, cw.pos.x);
            //         if (cw_stairway_side == boss_stairway_side && cw.in_stairway) {
            //             coworkers[index].controlled();
            //         }
            //     }
            // }
        }

    }
    render() {
        // only render boss when he is not working
        if (!this.working) {
            Person.prototype.render.call(this);
        }
        // render speech bubble
        if (this.cursing) {
            draw_speech_bubble(this.cursing_text, {x: this.pos.x, y: this.pos.y - this.height});
        }
    }
}

class Grass {
    constructor() {
        this.width = canv_w;
        this.height = canv_h/6;
    }
    rescale(new_w, new_h) {
        this.width = new_w;
        this.height = new_h/6;
    }
    render() {
        draw_rect({x: 0, y: canv_h - this.height}, this.width, this.height, "green");
    }
}

// re_init_all_vars(true);

// main update function

function update() {

    console.log(tapped_active)
    // only update if ingame
    if (game_state == "game") {
        // keep track of time in seconds
        endTime = new Date();
        secondsElapsed = (endTime - startTime)/1000;
        startTime = new Date();

        // set state of boss and update
        boss.update(building, doors_path, boss_door, secondsElapsed);

        // set state of coworkers (dependent on seconds passed)
        for (let index = 0; index < coworkers.length; index++) {
            coworkers[index].update(secondsElapsed);
        }

        // set state of doors (i.e. sleeping or talking text animations step forward)
        for (let index = 0; index < doors.length; index++) {
            doors[index].update(secondsElapsed);
        }

        // update bank account and timer
        bank_account.update();
        timer.update(secondsElapsed);

    }

    // after all updates: draw everything
    draw_all();
    // keep simulation going
    requestAnimationFrame(update);
    
}

// main draw function

function draw_all() {

    if (game_state == "choose_mode") {
        start_screen(hover_arrows_menu);
    }

    if (game_state == "instructions1") {
        show_instructions1();
    }

    if (game_state == "instructions2") {
        show_instructions2();
    }

    if (game_state == "game") {
        // sky
        set_canvas_bg(skycolor);
        // score bar on top of screen
        draw_rect({x: 0, y: 0}, canv_w, canv_h/6, "black");
        timer.render();
        // grass
        grass.render();
        // building
        building.render();
        for (let i=0; i<stories.length; i++) {
            let story = stories[i];
            story.render();
        }
        boss_door.render();
        for (let i=0; i<doors.length; i++) {
            doors[i].render();
        }
        for (let i=0; i<doors.length; i++) {
            doors[i].render_text();
        }
        for (let i=0; i<doors.length; i++) {
            doors[i].render_walk_path();
        }
        boss.render();
        for (let i=0; i<coworkers.length; i++) {
            let coworker = coworkers[i];
            coworker.render();
        }
        bank_account.render();
    }

    if (game_state == "highscores") {
        // display highscores
        draw_highscores(best_five_array);
    }

}

// event listener functions

function mousedown(e) {

    if (!tapped_active) {
        selected(e);
    }
    
}

function selected(e) {

    console.log(game_state)

    if (game_state == "choose_mode") {

        current_pos = getXY_exact(e, xscale, yscale);

        // if (e.which == 1) { // LMB

            // check at which height --> which menu option is clicked

            var ypos = canv_h/5 + canv_h/20;
            var step = canv_h/7;

            if (current_pos.x >= 0 && current_pos.x <= canv_w) {
                if (current_pos.y >= ypos + 1*step && current_pos.y <= ypos + 2*step) {
                    game_state = "instructions1"
                }
                if (current_pos.y >= ypos + 2*step && current_pos.y <= ypos + 3*step) {
                    re_init_all_vars();
                    game_state = "game"
                }
            }

        // }

    }

    else if (game_state == "instructions1") {
        game_state = "instructions2";
    }

    else if (game_state == "instructions2") {
        game_state = "choose_mode";
    }
    
    else if (game_state == "game") {

        current_pos = getXY_exact(e, xscale, yscale);

        // if (e.which == 1) { // LMB
            // check whether clicked in doors
            for (let index = 0; index < doors.length; index++) {
                if (doors[index].clicked_on(current_pos)) {
                    // first make sure the same door was not clicked on twice.
                    let next_door = false;
                    for (let index2 = 0; index2 < doors_path.length; index2++) {
                        if (doors[index].same_door(doors_path[index2])) {
                            next_door = true;
                        }
                    }
                    if (next_door) {
                        continue;
                    }
                    // not clicked on twice --> label the door
                    doors_path.push(doors[index]);
                    doors[index].label(doors_path.length);
                }
            }
            // checked whether clicked on opportunities
            // check if clicked on opportunities
            for (let index = 0; index < bank_account.opportunities.length; index++) {
                const opp = bank_account.opportunities[index];
                if (opp.clicked_on(current_pos)) {
                    
                    if (opp.type == "door") {
                        upgrade(bank_account.balance - opp.worth, true, false);
                    }
                    if (opp.type == "floor") {
                        upgrade(bank_account.balance - opp.worth, false, true);
                    }
                    
                }
            }
        // }

    }
    
    else if (game_state == "highscores") {
        // re-init all vars
        re_init_all_vars();
        game_state = "game";
    }
}

function tapped(e) {

    tapped_active = false; // TODO why tf does this has to be this way around?
    selected(e.changedTouches[0]);
    // e.preventDefault();
    // selected(e);

}

function not_tapped(e) {

    tapped_active = true;
}

function mousemove(e) {

    if (game_state == "choose_mode") {

        current_pos = getXY_exact(e, xscale, yscale);

        // check at which height --> which menu option is clicked

        var ypos = canv_h/5 + canv_h/20;
        var step = canv_h/7;

        hover_arrows_menu = [];

        if (current_pos.x >= 0 && current_pos.x <= canv_w) {
            if (current_pos.y >= ypos + 1*step && current_pos.y <= ypos + 2*step) {
                hover_arrows_menu.push({x: canv_w/4, y: ypos + 1.75*step});
            }
            if (current_pos.y >= ypos + 2*step && current_pos.y <= ypos + 3*step) {
                hover_arrows_menu.push({x: canv_w/4, y: ypos + 2.75*step});
            }
        }

    }

}

update();