#include "phylib.h"

phylib_object *phylib_new_still_ball(unsigned char number, phylib_coord *pos) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_STILL_BALL;
    new_obj->obj.still_ball.number = number;
    new_obj->obj.still_ball.pos = *pos;
    return new_obj;
}

phylib_object *phylib_new_rolling_ball(unsigned char number, phylib_coord *pos, phylib_coord *vel, phylib_coord *acc) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_ROLLING_BALL;
    new_obj->obj.rolling_ball.number = number;
    new_obj->obj.rolling_ball.pos = *pos;
    new_obj->obj.rolling_ball.vel = *vel;
    new_obj->obj.rolling_ball.acc = *acc;
    return new_obj;
}

phylib_object *phylib_new_hole(phylib_coord *pos) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_HOLE;
    new_obj->obj.hole.pos = *pos;
    return new_obj;
}

phylib_object *phylib_new_hcushion(double y) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_HCUSHION;
    new_obj->obj.hcushion.y = y;
    return new_obj;
}

phylib_object *phylib_new_vcushion(double x) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_VCUSHION;
    new_obj->obj.vcushion.x = x;
    return new_obj;
}

phylib_table *phylib_new_table(void) {
    phylib_table *new_table = malloc(sizeof(phylib_table));
    new_table->time = 0.0; // Set to 0.0 not phylib_sim_rate
    // Initalize objects to null to avoid valgrind complaints
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        new_table->object[i] = NULL;
    }
    // Adding cushions
    new_table->object[0] = phylib_new_hcushion(0.0);
    new_table->object[1] = phylib_new_hcushion(PHYLIB_TABLE_LENGTH);
    new_table->object[2] = phylib_new_vcushion(0.0);
    new_table->object[3] = phylib_new_vcushion(PHYLIB_TABLE_WIDTH);
    // Setting positions of corner holes
    phylib_coord corner_hole_pos[4] = {
        {0.0, 0.0},
        {0.0, PHYLIB_TABLE_WIDTH},
        {0.0, PHYLIB_TABLE_LENGTH},
        {PHYLIB_TABLE_WIDTH, PHYLIB_TABLE_LENGTH}
    };
    // Creating the corner holes
    for (int i = 0; i < 3; ++i) {
        new_table->object[4 + i] = phylib_new_hole(&corner_hole_pos[i]);
    }
    // This corner hole has to be in the 10th array slot according to the example output
    new_table->object[9] = phylib_new_hole(&corner_hole_pos[3]);
    // Setting positions of midway holes
    phylib_coord mid_hole_pos[2] = {
        {PHYLIB_TABLE_LENGTH / 2.0, 0.0},
        {PHYLIB_TABLE_WIDTH, PHYLIB_TABLE_LENGTH / 2.0},
    };
    // Creating the middle holes
    for (int i = 0; i < 2; ++i) {
        new_table->object[7 + i] = phylib_new_hole(&mid_hole_pos[i]);
    }
    return new_table;
}

// Part 2:
void phylib_copy_object(phylib_object **dest, phylib_object **src) {
    if (*src == NULL) {
        *dest = NULL;
        return;
    }   
    *dest = malloc(sizeof(phylib_object));
    memcpy(*dest, *src, sizeof(phylib_object));
}

phylib_table *phylib_copy_table(phylib_table *table) {
    phylib_table *new_table = malloc(sizeof(phylib_table));
    new_table->time = table->time;
    // Copy all objects within the old table to the new table
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        if (table->object[i] != NULL) {
            phylib_copy_object(&(new_table->object[i]), &(table->object[i]));
        }
        // So valgrind won't complain about uninitalized objects
        else {
            new_table->object[i] = NULL;
        }
    }
    return new_table;
}

void phylib_add_object(phylib_table *table, phylib_object *object) {
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        // Find a NULL pointer, assign it to the address of object
        if (!table->object[i]) {
            table->object[i] = object;
            return;
        }
    }
}

void phylib_free_table(phylib_table *table) {
    if (table != NULL) {
        // Free all objects within the table
        for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
            if (table->object[i] != NULL) {
                free(table->object[i]);
                table->object[i] = NULL;
            }
        }
        free(table);
    }
}

// Calculates the distance between two coordinates
phylib_coord phylib_sub(phylib_coord c1, phylib_coord c2) {
    phylib_coord result;
    result.x = c1.x - c2.x;
    result.y = c1.y - c2.y;
    return result;
}

// Calculates the length of the coordinate c
double phylib_length(phylib_coord c) {
    // Exp function is inefficent, thus unused
    return sqrt(c.x * c.x + c.y * c.y);
}

// Calculates the dot product
double phylib_dot_product(phylib_coord a, phylib_coord b) {
    return a.x * b.x + a.y * b.y;
}


double phylib_distance(phylib_object *obj1, phylib_object *obj2) {
    // Error checking as advised
    if (obj1 == NULL || obj2 == NULL) {
        return -1.0;
    }
    if (obj1->type != PHYLIB_ROLLING_BALL) {
        return -1.0;
    }
    phylib_coord center = obj1->obj.rolling_ball.pos;

    switch (obj2->type) {
        // Between two balls
        case PHYLIB_ROLLING_BALL:
            return phylib_length(phylib_sub(center, obj2->obj.rolling_ball.pos)) - PHYLIB_BALL_DIAMETER;
        case PHYLIB_STILL_BALL:
            return phylib_length(phylib_sub(center, obj2->obj.still_ball.pos)) - PHYLIB_BALL_DIAMETER;
        // Between a ball and hole
        case PHYLIB_HOLE:
            return phylib_length(phylib_sub(center, obj2->obj.hole.pos)) - PHYLIB_HOLE_RADIUS;
        // Between a ball and a horizontal cushion
        case PHYLIB_HCUSHION:
            return fabs(center.y - obj2->obj.hcushion.y) - PHYLIB_BALL_RADIUS; // fabs is the absolute value for doubles/floats
        // Between a ball and a vertical cushion
        case PHYLIB_VCUSHION:
            return fabs(center.x - obj2->obj.vcushion.x) - PHYLIB_BALL_RADIUS;
        default:
            return -1.0;
    }
}

// Part 3:
void phylib_roll(phylib_object *new, phylib_object *old, double time) {
    // Check if both objects are rolling balls
    if (new->type != PHYLIB_ROLLING_BALL || old->type != PHYLIB_ROLLING_BALL) {
        return;
    }
    // Update position
    new->obj.rolling_ball.pos.x = old->obj.rolling_ball.pos.x + old->obj.rolling_ball.vel.x * time + 0.5 * old->obj.rolling_ball.acc.x * time * time;
    new->obj.rolling_ball.pos.y = old->obj.rolling_ball.pos.y + old->obj.rolling_ball.vel.y * time + 0.5 * old->obj.rolling_ball.acc.y * time * time;
    // Update velocity
    new->obj.rolling_ball.vel.x = old->obj.rolling_ball.vel.x + old->obj.rolling_ball.acc.x * time;
    new->obj.rolling_ball.vel.y = old->obj.rolling_ball.vel.y + old->obj.rolling_ball.acc.y * time;     
    // Check if the ball has changed direction  
    if ((old->obj.rolling_ball.vel.x * new->obj.rolling_ball.vel.x) < 0) {
        new->obj.rolling_ball.vel.x = 0;
        new->obj.rolling_ball.acc.x = 0;
    }
    if ((old->obj.rolling_ball.vel.y * new->obj.rolling_ball.vel.y) < 0) {
        new->obj.rolling_ball.vel.y = 0;
        new->obj.rolling_ball.acc.y = 0;
    }
}

unsigned char phylib_stopped(phylib_object *object) {
    // Calculate speed using the length of velocity vector
    double speed = phylib_length(object->obj.rolling_ball.vel);
    if (speed < PHYLIB_VEL_EPSILON) {
        object->type = PHYLIB_STILL_BALL;
        return 1;
    }
    return 0;
}

void phylib_bounce(phylib_object **a, phylib_object **b) {
    // Flip y-axis values for bouncing into a horizontal cushion
    if ((*b)->type == PHYLIB_HCUSHION) {
        (*a)->obj.rolling_ball.vel.y = -(*a)->obj.rolling_ball.vel.y;
        (*a)->obj.rolling_ball.acc.y = -(*a)->obj.rolling_ball.acc.y;
        return;
    }
    // Flip the x-axis values for bouncing into a vertical cushion
    else if ((*b)->type == PHYLIB_VCUSHION) {
        (*a)->obj.rolling_ball.vel.x = -(*a)->obj.rolling_ball.vel.x;
        (*a)->obj.rolling_ball.acc.x = -(*a)->obj.rolling_ball.acc.x;
        return;
    }
    // Get rid of the rolling ball because it sank into a hole
    else if ((*b)->type == PHYLIB_HOLE) {
        free(*a);
        *a = NULL;
        return;
    }
    // The rolling ball hits a still ball
    else if ((*b)->type == PHYLIB_STILL_BALL) {
        (*b)->type = PHYLIB_ROLLING_BALL;
        // Initialize the velocity and acceleration for the new rolling ball
        (*b)->obj.rolling_ball.vel.x = 0.0;
        (*b)->obj.rolling_ball.vel.y = 0.0;
        (*b)->obj.rolling_ball.acc.x = 0.0;
        (*b)->obj.rolling_ball.acc.y = 0.0;
    }
    // Two rolling balls colliding
    // Compute the position of a with respect to b
    phylib_coord r_ab = phylib_sub((*a)->obj.rolling_ball.pos, (*b)->obj.rolling_ball.pos);
    // Compute the relative velocity of a with respect to b
    phylib_coord v_rel = phylib_sub((*a)->obj.rolling_ball.vel, (*b)->obj.rolling_ball.vel);
    // Calculate the normal vector
    phylib_coord n = {r_ab.x / phylib_length(r_ab), r_ab.y / phylib_length(r_ab)};
    // Calculate the ratio of the relative velocity
    double v_rel_n = phylib_dot_product(v_rel, n);
    // Update velocities based on all the calculations
    (*a)->obj.rolling_ball.vel.x -= v_rel_n * n.x;
    (*a)->obj.rolling_ball.vel.y -= v_rel_n * n.y;
    (*b)->obj.rolling_ball.vel.x += v_rel_n * n.x;
    (*b)->obj.rolling_ball.vel.y += v_rel_n * n.y;
    // Compute the balls speed
    double speed_a = phylib_length((*a)->obj.rolling_ball.vel);
    double speed_b = phylib_length((*b)->obj.rolling_ball.vel);
    // Check if the speed is greater than PHYLIB_VEL_EPSILON, if so add drag
    if (speed_a > PHYLIB_VEL_EPSILON) {
        (*a)->obj.rolling_ball.acc.x = -(*a)->obj.rolling_ball.vel.x / speed_a * PHYLIB_DRAG;
        (*a)->obj.rolling_ball.acc.y = -(*a)->obj.rolling_ball.vel.y / speed_a * PHYLIB_DRAG;
    }
    if (speed_b > PHYLIB_VEL_EPSILON) {
        (*b)->obj.rolling_ball.acc.x = -(*b)->obj.rolling_ball.vel.x / speed_b * PHYLIB_DRAG;
        (*b)->obj.rolling_ball.acc.y = -(*b)->obj.rolling_ball.vel.y / speed_b * PHYLIB_DRAG;
    }
}

// Returns the number of rolling balls on the table
unsigned char phylib_rolling(phylib_table *t) {
    unsigned char rolling_count = 0;
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        // Might want to check for NULL; t->object[i]
        if (t->object[i] != NULL && t->object[i]->type == PHYLIB_ROLLING_BALL) {
            rolling_count++;
        }
    }
    return rolling_count;
}

phylib_table *phylib_segment(phylib_table *table) {
    // Check if there are any rolling balls on the table
    if (phylib_rolling(table) == 0) {
        return NULL;
    }
    phylib_table *copied_table = phylib_copy_table(table);

    while (copied_table->time < PHYLIB_MAX_TIME) {

        // Roll balls in this loop
        for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
            if (copied_table->object[i] && copied_table->object[i]->type == PHYLIB_ROLLING_BALL) {
                phylib_object *new_state = NULL;
                phylib_copy_object(&new_state, &copied_table->object[i]);
                phylib_roll(new_state, copied_table->object[i], PHYLIB_SIM_RATE);
                free(copied_table->object[i]);
                copied_table->object[i] = new_state;
            }
        }

        // Check for bounces and stops in this loop
        for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
            if (copied_table->object[i] && copied_table->object[i]->type == PHYLIB_ROLLING_BALL) {
                if (phylib_stopped(copied_table->object[i])) {
                    return copied_table;
                }
                for (int j = 0; j < PHYLIB_MAX_OBJECTS; j++) {
                    if (i != j && copied_table->object[j]) {
                        double distance = phylib_distance(copied_table->object[i], copied_table->object[j]);
                        if (distance < 0.0) {
                            // Check if a collision occurred
                            phylib_bounce(&copied_table->object[i], &copied_table->object[j]);
                            return copied_table;
                        }
                    }
                }
            }
        }
        copied_table->time += PHYLIB_SIM_RATE;
    }
    // Maximum time reached without stopping or collisions
    return copied_table;
}

char *phylib_object_string( phylib_object *object ) {
    static char string[80];
    if (object == NULL) {
        snprintf( string, 80, "NULL;" );
        return string;
    }
    switch (object->type) {
        case PHYLIB_STILL_BALL:
            snprintf( string, 80,
                "STILL_BALL (%d,%6.1lf,%6.1lf)",
                object->obj.still_ball.number,
                object->obj.still_ball.pos.x,
                object->obj.still_ball.pos.y );
            break;
        case PHYLIB_ROLLING_BALL:
            snprintf( string, 80,
                "ROLLING_BALL (%d,%6.1lf,%6.1lf,%6.1lf,%6.1lf,%6.1lf,%6.1lf)",
                object->obj.rolling_ball.number,
                object->obj.rolling_ball.pos.x,
                object->obj.rolling_ball.pos.y,
                object->obj.rolling_ball.vel.x,
                object->obj.rolling_ball.vel.y,
                object->obj.rolling_ball.acc.x,
                object->obj.rolling_ball.acc.y );
            break;
        case PHYLIB_HOLE:
            snprintf( string, 80,
                "HOLE (%6.1lf,%6.1lf)",
                object->obj.hole.pos.x,
                object->obj.hole.pos.y );
            break;
        case PHYLIB_HCUSHION:
            snprintf( string, 80,
                "HCUSHION (%6.1lf)",
                object->obj.hcushion.y );
            break;
        case PHYLIB_VCUSHION:
            snprintf( string, 80,
                "VCUSHION (%6.1lf)",
                object->obj.vcushion.x );
            break;
    }
    return string;
}
